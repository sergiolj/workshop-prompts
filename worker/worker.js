// Worker da Cloudflare para o Laboratório de prompts.
// Recebe {input} (texto ou lista de {role, content}), chama a IA e devolve {text}.
// Variáveis e segredos (configure no painel da Cloudflare, nunca neste arquivo):
//   ALLOWED_ORIGIN    ex.: https://seu-usuario.github.io   (só este site pode chamar)
//   GEMINI_API_KEY    (segredo) chave do Google AI Studio
//   ANTHROPIC_API_KEY (segredo, opcional) se existir, usa o Claude no lugar do Gemini
//   GEMINI_MODEL      opcional, padrão "gemini-flash-latest"
//   CLAUDE_MODEL      opcional, padrão "claude-haiku-5-5"

const MAX_CHARS = 8000;        // tamanho máximo de tudo que o aluno envia
const MAX_TURNS = 24;          // mensagens por conversa
const RATE_PER_MIN = 20;       // pedidos por minuto por IP (por instância do Worker)
const hits = new Map();

function cors(env, req) {
  const o = req.headers.get("Origin") || "";
  const ok = env.ALLOWED_ORIGIN === "*" || o === env.ALLOWED_ORIGIN;
  return {
    ok,
    headers: {
      "Access-Control-Allow-Origin": ok ? o : "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    },
  };
}
const json = (obj, status, h) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...h } });

function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > RATE_PER_MIN;
}

function toTurns(input) {
  if (typeof input === "string") return [{ role: "user", content: input }];
  if (!Array.isArray(input)) return null;
  const t = input.filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string");
  if (!t.length || t[t.length - 1].role !== "user") return null;
  return t;
}

async function callGemini(env, turns) {
  const model = env.GEMINI_MODEL || "gemini-flash-latest";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: turns.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
    }),
  });
  if (!r.ok) return { status: r.status };
  const d = await r.json();
  const text = (d.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("").trim();
  return { text, model };
}

async function callClaude(env, turns) {
  const model = env.CLAUDE_MODEL || "claude-haiku-5-5";
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 1024, messages: turns }),
  });
  if (!r.ok) return { status: r.status };
  const d = await r.json();
  const text = (d.content || []).map(p => p.text || "").join("").trim();
  return { text, model };
}

export default {
  async fetch(req, env) {
    const c = cors(env, req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: c.headers });
    if (req.method !== "POST") return json({ message: "método não permitido" }, 405, c.headers);
    if (!c.ok) return json({ message: "origem não permitida" }, 403, c.headers);

    const ip = req.headers.get("CF-Connecting-IP") || "?";
    if (limited(ip)) return json({ message: "muitos pedidos" }, 429, c.headers);

    let body;
    try { body = await req.json(); } catch { return json({ message: "JSON inválido" }, 400, c.headers); }
    const turns = toTurns(body.input);
    if (!turns || turns.length > MAX_TURNS) return json({ message: "entrada inválida" }, 400, c.headers);
    if (turns.reduce((n, m) => n + m.content.length, 0) > MAX_CHARS) return json({ message: "texto longo demais" }, 400, c.headers);

    let out;
    try {
      out = env.ANTHROPIC_API_KEY ? await callClaude(env, turns) : await callGemini(env, turns);
    } catch {
      return json({ message: "falha ao chamar a IA" }, 502, c.headers);
    }
    if (out.status) return json({ message: "a IA recusou o pedido" }, out.status === 429 ? 429 : 502, c.headers);
    if (!out.text) return json({ message: "resposta vazia" }, 502, c.headers);
    return json({ text: out.text, model: out.model }, 200, c.headers);
  },
};
