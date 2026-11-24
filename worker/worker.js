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
// Cada um devolve {text, model} em caso de sucesso ou {status} com o código HTTP do erro.

async function askGemini(env, turns) {
  const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: turns.map(turn => ({ role: turn.role === "assistant" ? "model" : "user", parts: [{ text: turn.content }] })),
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.7 },
    }),
  });
  if (!response.ok) return { status: response.status };
  const data = await response.json();
  const candidate = data.candidates?.[0];
  const text = joinTextParts(candidate?.content?.parts || []);
  return { text: markIfTruncated(text, candidate?.finishReason === "MAX_TOKENS"), model };
}

async function askClaude(env, turns) {
  const model = env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: MAX_OUTPUT_TOKENS, messages: turns }),
  });
  if (!response.ok) return { status: response.status };
  const data = await response.json();
  return { text: markIfTruncated(joinTextParts(data.content || []), data.stop_reason === "max_tokens"), model };
}

const joinTextParts = parts => parts.map(part => part.text || "").join("").trim();

// Avisa o aluno quando a resposta foi cortada, em vez de terminar o texto no meio sem explicação.
const markIfTruncated = (text, wasTruncated) => text && wasTruncated ? text + TRUNCATION_NOTICE : text;

// Com a chave do Claude configurada, ela tem preferência sobre o Gemini.
const askAi = (env, turns) => env.ANTHROPIC_API_KEY ? askClaude(env, turns) : askGemini(env, turns);

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
    } catch {
      return reply({ message: "falha ao chamar a IA" }, 502);
    }
    if (result.status) return reply({ message: "a IA recusou o pedido" }, result.status === 429 ? 429 : 502);
    if (!result.text) return reply({ message: "resposta vazia" }, 502);
    return reply({ text: result.text, model: result.model }, 200);
  },
};
