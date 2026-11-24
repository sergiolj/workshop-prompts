// Worker da Cloudflare para o Laboratório de prompts.
// Recebe {input} (texto ou lista de {role, content}), chama a IA e devolve {text, model}.
// Variáveis e segredos (configure no painel da Cloudflare, nunca neste arquivo):
//   ALLOWED_ORIGIN    ex.: https://seu-usuario.github.io   (só este site pode chamar)
//   GEMINI_API_KEY    (segredo) chave do Google AI Studio
//   ANTHROPIC_API_KEY (segredo, opcional) se existir, usa o Claude no lugar do Gemini
//   GEMINI_MODEL      opcional, padrão "gemini-flash-latest"
//   CLAUDE_MODEL      opcional, padrão "claude-haiku-5-5"

// Tamanho máximo de tudo que é enviado (na etapa 7, inclui o histórico da conversa com as respostas da IA).
const MAX_TOTAL_CHARACTERS = 40000;
const MAX_TURNS = 24;                // mensagens por conversa
const MAX_REQUESTS_PER_MINUTE = 20;  // por IP (por instância do Worker)
const MAX_TRACKED_IPS = 5000;        // acima disso, a contagem é zerada para não crescer sem limite
// Limite de tamanho da resposta. No Gemini, os tokens de "raciocínio" do modelo também contam
// neste limite; um valor baixo (ex.: 1024) corta respostas no meio.
const MAX_OUTPUT_TOKENS = 8192;
// Limite usado antes da correção das respostas cortadas. Se a IA recusar o limite maior,
// o Worker repete o pedido com este valor, que já funcionava.
const FALLBACK_OUTPUT_TOKENS = 1024;
const TRUNCATION_NOTICE = "\n\n[Resposta interrompida: a IA atingiu o limite de tamanho.]";
const ONE_MINUTE_MS = 60000;

const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";
const DEFAULT_CLAUDE_MODEL = "claude-haiku-5-5";

const requestTimesByIp = new Map();

// ---------- HTTP ----------

function buildCorsPolicy(env, request) {
  const origin = request.headers.get("Origin") || "";
  const isAllowed = env.ALLOWED_ORIGIN === "*" || origin === env.ALLOWED_ORIGIN;
  return {
    isAllowed,
    headers: {
      "Access-Control-Allow-Origin": isAllowed ? origin : "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    },
  };
}

const jsonResponse = (body, status, headers) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

// ---------- Proteções ----------

function isRateLimited(ip) {
  const now = Date.now();
  const recentRequests = (requestTimesByIp.get(ip) || []).filter(time => now - time < ONE_MINUTE_MS);
  recentRequests.push(now);
  requestTimesByIp.set(ip, recentRequests);
  if (requestTimesByIp.size > MAX_TRACKED_IPS) requestTimesByIp.clear();
  return recentRequests.length > MAX_REQUESTS_PER_MINUTE;
}

// Aceita um texto ou uma conversa que termine com uma mensagem do aluno. Devolve null se for inválido.
function parseConversation(input) {
  if (typeof input === "string") return [{ role: "user", content: input }];
  if (!Array.isArray(input)) return null;
  const turns = input.filter(turn => turn && (turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string");
  if (!turns.length || turns[turns.length - 1].role !== "user") return null;
  return turns;
}

const totalCharacters = turns => turns.reduce((sum, turn) => sum + turn.content.length, 0);

// Devolve a mensagem de erro, ou null se a conversa puder ser enviada.
function validateConversation(turns) {
  if (!turns || turns.length > MAX_TURNS) return "entrada inválida";
  if (totalCharacters(turns) > MAX_TOTAL_CHARACTERS) return "texto longo demais";
  return null;
}

// ---------- Provedores de IA ----------
// Cada um devolve {text, model} em caso de sucesso ou {status, detail} com o código HTTP e o motivo do erro.

// Erros temporários (servidor da IA sobrecarregado) ganham uma nova tentativa.
const TRANSIENT_STATUSES = [500, 503];
const RETRY_DELAY_MS = 1500;
const MAX_ERROR_DETAIL_CHARACTERS = 300;

async function fetchWithRetry(url, init) {
  const response = await fetch(url, init);
  if (!TRANSIENT_STATUSES.includes(response.status)) return response;
  await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
  return fetch(url, init);
}

// Lê a mensagem de erro da IA (ex.: "The model is overloaded") para mostrar ao aluno e nos Logs.
async function describeProviderError(providerName, response) {
  let reason = "";
  try {
    const data = await response.json();
    reason = data.error?.message || "";
  } catch { /* resposta sem JSON */ }
  const detail = `${providerName} HTTP ${response.status}${reason ? ": " + reason : ""}`.slice(0, MAX_ERROR_DETAIL_CHARACTERS);
  console.error(detail);
  return { status: response.status, detail };
}

async function askGemini(env, turns, maxOutputTokens) {
  const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: turns.map(turn => ({ role: turn.role === "assistant" ? "model" : "user", parts: [{ text: turn.content }] })),
      generationConfig: { maxOutputTokens, temperature: 0.7 },
    }),
  });
  if (!response.ok) return describeProviderError("Gemini", response);
  const data = await response.json();
  const candidate = data.candidates?.[0];
  const text = joinTextParts(candidate?.content?.parts || []);
  const finishReason = candidate?.finishReason || data.promptFeedback?.blockReason || "";
  return { text: markIfTruncated(text, finishReason === "MAX_TOKENS"), model, detail: text ? "" : "Gemini: " + (finishReason || "sem texto") };
}

async function askClaude(env, turns, maxOutputTokens) {
  const model = env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL;
  const response = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxOutputTokens, messages: turns }),
  });
  if (!response.ok) return describeProviderError("Claude", response);
  const data = await response.json();
  return { text: markIfTruncated(joinTextParts(data.content || []), data.stop_reason === "max_tokens"), model };
}

const joinTextParts = parts => parts.map(part => part.text || "").join("").trim();

// Avisa o aluno quando a resposta foi cortada, em vez de terminar o texto no meio sem explicação.
const markIfTruncated = (text, wasTruncated) => text && wasTruncated ? text + TRUNCATION_NOTICE : text;

// Com a chave do Claude configurada, ela tem preferência sobre o Gemini.
const askProvider = (env, turns, maxOutputTokens) =>
  env.ANTHROPIC_API_KEY ? askClaude(env, turns, maxOutputTokens) : askGemini(env, turns, maxOutputTokens);

// Erros que não mudam ao reduzir o limite de resposta: cota, chave e modelo.
const ERRORS_UNRELATED_TO_OUTPUT_LIMIT = [401, 403, 404, 429];

// Tenta com o limite maior; se a IA recusar por outro motivo, repete com o limite antigo.
async function askAi(env, turns) {
  const result = await askProvider(env, turns, MAX_OUTPUT_TOKENS);
  if (!result.status || ERRORS_UNRELATED_TO_OUTPUT_LIMIT.includes(result.status)) return result;
  console.error(`limite de ${MAX_OUTPUT_TOKENS} tokens recusado (${result.detail}); repetindo com ${FALLBACK_OUTPUT_TOKENS}`);
  return askProvider(env, turns, FALLBACK_OUTPUT_TOKENS);
}

// Erros da IA repassados à página: 429 (cota) e 503 (sobrecarga) a página trata como "ocupada".
function responseStatusFor(providerStatus) {
  return providerStatus === 429 || providerStatus === 503 ? providerStatus : 502;
}

function providerErrorMessage(providerStatus) {
  if (providerStatus === 429) return "cota da IA esgotada ou muitos pedidos";
  if (providerStatus === 503) return "a IA está sobrecarregada";
  if (providerStatus === 401 || providerStatus === 403) return "chave da IA inválida ou sem permissão";
  if (providerStatus === 404) return "modelo da IA não encontrado";
  return "a IA recusou o pedido";
}

// ---------- Entrada ----------

export default {
  async fetch(request, env) {
    const cors = buildCorsPolicy(env, request);
    const reply = (body, status) => jsonResponse(body, status, cors.headers);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors.headers });
    if (request.method !== "POST") return reply({ message: "método não permitido" }, 405);
    if (!cors.isAllowed) return reply({ message: "origem não permitida" }, 403);
    if (isRateLimited(request.headers.get("CF-Connecting-IP") || "?")) return reply({ message: "muitos pedidos" }, 429);

    let body;
    try { body = await request.json(); } catch { return reply({ message: "JSON inválido" }, 400); }
    const turns = parseConversation(body.input);
    const validationError = validateConversation(turns);
    if (validationError) return reply({ message: validationError }, 400);

    let result;
    try {
      result = await askAi(env, turns);
    } catch (error) {
      console.error("falha ao chamar a IA:", String(error));
      return reply({ message: "falha ao chamar a IA", detail: String(error) }, 502);
    }
    if (result.status) return reply({ message: providerErrorMessage(result.status), detail: result.detail }, responseStatusFor(result.status));
    if (!result.text) return reply({ message: "resposta vazia", detail: result.detail }, 502);
    return reply({ text: result.text, model: result.model }, 200);
  },
};
