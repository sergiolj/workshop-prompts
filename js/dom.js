// Funções utilitárias para lidar com a página (DOM) e com texto.

export const byId = id => document.getElementById(id);

export function escapeHtml(text) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
  return String(text).replace(/[&<>"]/g, character => entities[character]);
}

// Converte o pouco de Markdown que a IA costuma usar (títulos e **negrito**) em negrito HTML.
export function formatAiText(text) {
  return escapeHtml(text)
    .replace(/^#{1,4}\s*(.+)$/gm, "<b>$1</b>")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

export function createElement(tag, { className, text, type } = {}) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  if (type) element.type = type;
  return element;
}

export function createButton(label, className, onClick) {
  const button = createElement("button", { className, text: label, type: "button" });
  button.onclick = onClick;
  return button;
}

export function setPressed(button, isPressed) {
  button.setAttribute("aria-pressed", String(isPressed));
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Mostra um texto temporário no botão (ex.: "Copiado") e depois volta ao original.
export function showTemporaryLabel(button, temporaryLabel, originalLabel, durationMs) {
  button.textContent = temporaryLabel;
  setTimeout(() => { button.textContent = originalLabel; }, durationMs);
}

// Copia o texto de um campo. Se o navegador não deixar, seleciona o texto para o aluno copiar.
export async function copyFieldWithFeedback(field, button) {
  const originalLabel = "Copiar prompt";
  const copied = await copyToClipboard(field.value);
  if (!copied) field.select();
  showTemporaryLabel(button, copied ? "Copiado" : "Selecione e copie", originalLabel, 1800);
}

// Normaliza para comparar palavras: minúsculas e sem acentos.
export function normalizeText(text) {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export const lowercaseFirstLetter = text => text.charAt(0).toLowerCase() + text.slice(1);

export const ensureEndsWithPunctuation = text => /[.?!]$/.test(text) ? text : text + ".";

export const removeTrailingPunctuation = text => text.trim().replace(/[.!\s]+$/, "");

// ["a", "b", "c"] -> "a, b e c"
export function joinWithAnd(items) {
  if (items.length < 2) return items.join("");
  return items.slice(0, -1).join(", ") + " e " + items[items.length - 1];
}
