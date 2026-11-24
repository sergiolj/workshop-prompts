// Comunicação com a IA através do Worker da Cloudflare.
// O Worker guarda a chave da IA; a página só conhece o endereço dele.
import { WORKER_URL, WORKER_TIMEOUT_MS } from "./config.js";

// Erros têm { code, message }. code: "network", "rate_limited", "error" ou "not_granted".
class AiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Envia uma mensagem (texto) ou uma conversa ([{role, content}]) e devolve {text, modelApplied}.
 * Se options.onText for passado, ele recebe o texto parcial enquanto a resposta chega.
 */
async function askWorker(input, options = {}) {
  const wantsStreaming = Boolean(options.onText);
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), WORKER_TIMEOUT_MS);
  if (options.signal) options.signal.addEventListener("abort", () => abortController.abort());
  try {
    const response = await postToWorker(input, wantsStreaming, abortController.signal);
    if (!response.ok) throw await buildHttpError(response);
    const isStream = (response.headers.get("Content-Type") || "").includes("text/event-stream");
    return isStream ? await readStreamedReply(response, options.onText) : await readJsonReply(response, options.onText);
  } finally {
    clearTimeout(timeout);
  }
}

async function postToWorker(input, wantsStreaming, signal) {
  try {
    return await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, stream: wantsStreaming }),
      signal,
    });
  } catch (error) {
    const reason = error && error.name === "AbortError"
      ? "o Worker não respondeu em 90 segundos"
      : "sem conexão com o Worker (confira o WORKER_URL e o ALLOWED_ORIGIN): " + String(error);
    throw new AiError("network", reason);
  }
}

async function buildHttpError(response) {
  let details = {};
  try { details = await response.json(); } catch { /* resposta sem JSON */ }
  const isRateLimited = response.status === 429 || response.status === 503;
  const message = (details.message || "erro") + (details.detail ? " – " + details.detail : "") + " [HTTP " + response.status + "]";
  return new AiError(isRateLimited ? "rate_limited" : "error", message);
}

async function readJsonReply(response, onText) {
  const data = await response.json();
  if (onText) onText({ text: data.text, delta: data.text });
  return { text: data.text, modelApplied: data.model };
}

// Lê uma resposta em partes (Server-Sent Events: linhas "data: {t, model}").
async function readStreamedReply(response, onText) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pendingLine = "", fullText = "", model = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      pendingLine += decoder.decode(value, { stream: true });
      const lines = pendingLine.split("\n");
      pendingLine = lines.pop();
      for (const event of lines.map(parseStreamLine).filter(Boolean)) {
        if (event.t) {
          fullText += event.t;
          if (onText) onText({ text: fullText, delta: event.t });
        }
        if (event.model) model = event.model;
      }
    }
  } catch (error) {
    throw new AiError("network", "a resposta foi interrompida: " + String(error));
  }
  if (!fullText.trim()) throw new AiError("error", "resposta vazia [HTTP 200]");
  return { text: fullText.trim(), modelApplied: model };
}

function parseStreamLine(line) {
  if (!line.startsWith("data:")) return null;
  try { return JSON.parse(line.slice(5)); } catch { return null; }
}

/**
 * Devolve a função usada para falar com a IA do painel, ou null se não houver IA.
 * Sem WORKER_URL, usa a IA do ambiente (window.claude), quando a página roda como Artifact do Claude.
 */
export async function connectToAi() {
  if (WORKER_URL) return askWorker;
  try {
    return window.claude && window.claude.use ? await window.claude.use("sample") : null;
  } catch {
    return null;
  }
}
