// Painel de IA: escolha da ferramenta, lista de conversas, mensagens e campo de envio.
import {
  BUILT_IN_TOOL, DEFAULT_EXTERNAL_TOOL, FREE_CONVERSATION, QUESTION_TYPES, TEMPLATE_CONVERSATION, TEMPLATE_STEP, TOOLS,
  isQuestionKey, isQuestionStep, questionKeyOfStep,
} from "./content.js";
import { byId, createButton, createElement, copyFieldWithFeedback, escapeHtml, formatAiText, setPressed } from "./dom.js";
import {
  lab, student, createAnswer, findOrCreateConversation, getCurrentConversation, isContinuousConversationStep,
  isUsingBuiltInAi, removeConversation,
} from "./state.js";
import { renderEvaluation } from "./evaluation.js";

const EXTERNAL_TOOL_IDS = ["gemini", "chatgpt", "claude"];
const WAITING_FOR_REPLY = "Gerando resposta…";
// Texto provisório que alguns ambientes mandam antes da resposta de verdade.
const THINKING_PLACEHOLDER = "Thinking...";

// ---------- Abas (telas estreitas) ----------

export function setActiveView(view) {
  byId("workspace").dataset.activeView = view;
  byId("tab-guide").setAttribute("aria-selected", String(view === "guide"));
  byId("tab-ai").setAttribute("aria-selected", String(view === "ai"));
}

// ---------- Desenho do painel ----------

// A conversa pertence à pergunta da etapa atual, ao modelo da etapa 7 ou é livre (etapas 1 e 6).
function conversationKeyForCurrentStep() {
  if (isQuestionStep(student.step)) return questionKeyOfStep(student.step);
  return student.step === TEMPLATE_STEP ? TEMPLATE_CONVERSATION : FREE_CONVERSATION;
}

function conversationTitle(conversation) {
  const baseTitle = conversation.questionKey === FREE_CONVERSATION ? "Pergunta livre"
    : conversation.questionKey === TEMPLATE_CONVERSATION ? "Etapa 7"
      : QUESTION_TYPES[conversation.questionKey].name;
  const sameKind = lab.conversations.filter(other => other.questionKey === conversation.questionKey);
  return sameKind.length > 1 ? baseTitle + " (" + (sameKind.indexOf(conversation) + 1) + ")" : baseTitle;
}

function selectConversation(conversationId) {
  lab.currentConversationId = conversationId;
  lab.warningMessage = "";
  renderAiPanel();
}

export function renderAiPanel() {
  renderToolPicker();
  renderPanelInfo();
  renderConversationList();
  renderConversationNote();
  renderThread();
  renderComposer();
}

function renderToolPicker() {
  const picker = byId("tool-picker");
  picker.replaceChildren();
  if (!lab.isPanelReady) return;
  const toolIds = lab.askAi ? [BUILT_IN_TOOL, ...EXTERNAL_TOOL_IDS] : EXTERNAL_TOOL_IDS;
  toolIds.forEach(toolId => {
    const button = createButton(TOOLS[toolId].name, "chip", () => {
      lab.selectedToolId = toolId;
      lab.warningMessage = "";
      renderAiPanel();
    });
    setPressed(button, toolId === lab.selectedToolId);
    picker.appendChild(button);
  });
}

function renderPanelInfo() {
  const info = byId("ai-panel-info");
  if (!lab.isPanelReady) {
    info.textContent = "Conectando…";
    return;
  }
  if (isUsingBuiltInAi()) {
    const conversation = getCurrentConversation();
    const modelNote = conversation && conversation.model ? " Respondeu: " + conversation.model + "." : "";
    info.textContent = "IA do laboratório, enviada por um servidor do projeto." + modelNote;
  } else {
    const tool = TOOLS[lab.selectedToolId];
    info.innerHTML = `Abra o <a href="${tool.url}" target="_blank" rel="noopener">${escapeHtml(tool.shortName)}</a> em outra janela, de preferência lado a lado com esta. Pode pedir login com conta gratuita.`;
  }
}

function renderConversationList() {
  const list = byId("conversation-list");
  list.replaceChildren();
  if (!lab.conversations.length) {
    list.hidden = true;
    return;
  }
  list.hidden = false;
  list.appendChild(createElement("span", { className: "conversation-list-label", text: "Conversas" }));
  lab.conversations.forEach(conversation => {
    const button = createButton(conversationTitle(conversation), "button-link", () => selectConversation(conversation.id));
    if (conversation.id === lab.currentConversationId) button.setAttribute("aria-current", "true");
    list.appendChild(button);
  });
  list.appendChild(createButton("Nova conversa", "button-link", () => selectConversation(null)));
}

function conversationNoteText() {
  const conversation = getCurrentConversation();
  const isContinuous = isContinuousConversationStep();
  if (!isUsingBuiltInAi()) {
    return isContinuous
      ? "Na sua ferramenta, continue na mesma conversa e registre aqui cada troca."
      : "Abra um chat novo na sua ferramenta para cada etapa, sem memória dos anteriores.";
  }
  if (isContinuous) {
    return conversation && conversation.isContinuous
      ? "Conversa contínua: a IA lembra de tudo o que foi dito nela. Use Nova conversa para recomeçar."
      : "Conversa contínua: depois da primeira mensagem, a IA lembra de tudo o que for dito nela.";
  }
  return conversation
    ? "Conversa encerrada. O próximo envio abre uma conversa nova, sem memória desta."
    : "Cada envio abre uma conversa nova, sem memória das anteriores.";
}

function renderConversationNote() {
  const note = byId("conversation-note");
  const hasWarning = Boolean(lab.warningMessage);
  note.className = hasWarning ? "conversation-note is-warning" : "conversation-note";
  note.textContent = hasWarning ? lab.warningMessage : conversationNoteText();
}

function renderThread() {
  const thread = byId("thread");
  thread.replaceChildren();
  const conversation = getCurrentConversation();
  if (!conversation) {
    thread.appendChild(createElement("p", {
      className: "thread-empty",
      text: isContinuousConversationStep()
        ? "Escreva a primeira mensagem. A partir dela, a IA lembra de tudo o que for dito nesta conversa."
        : "Escreva um prompt para abrir uma conversa nova.",
    }));
    return;
  }
  const continuousNote = conversation.isContinuous ? " · conversa contínua" : "";
  thread.appendChild(createElement("div", {
    className: "thread-title",
    text: conversationTitle(conversation) + " · " + TOOLS[conversation.toolId].shortName + continuousNote,
  }));
  conversation.turns.forEach(turn => {
    if (turn.role === "user") {
      thread.appendChild(createElement("div", { className: "message-user", text: turn.content }));
    } else {
      const message = createElement("div", { className: "message-ai" });
      message.innerHTML = formatAiText(turn.content);
      thread.appendChild(message);
    }
  });
  if (conversation.isAwaitingReply) {
    const pendingMessage = createElement("div", { className: "message-ai" });
    pendingMessage.dataset.streaming = "true";
    pendingMessage.innerHTML = conversation.partialReply ? formatAiText(conversation.partialReply) : WAITING_FOR_REPLY;
    thread.appendChild(pendingMessage);
  }
  if (isQuestionKey(conversation.questionKey) && !conversation.isAwaitingReply) {
    thread.appendChild(createButton("Voltar ao roteiro", "button-secondary back-to-guide", () => {
      setActiveView("guide");
      window.scrollTo(0, 0);
    }));
  }
  scrollThreadToBottom();
}

function scrollThreadToBottom() {
  const thread = byId("thread");
  thread.scrollTop = thread.scrollHeight;
}

// Nas etapas 2 a 5 o campo de envio fica dentro do roteiro; nas outras, no painel de IA.
function placeComposer() {
  const composer = byId("composer");
  const onQuestionStep = isQuestionStep(student.step);
  const target = onQuestionStep
    ? byId("composer-slot-" + questionKeyOfStep(student.step))
    : document.querySelector(".ai-panel");
  if (composer.parentNode !== target) target.appendChild(composer);
  composer.hidden = onQuestionStep && Boolean(lab.answers[questionKeyOfStep(student.step)]);
}

export function renderComposer() {
  const usesExternalTool = lab.isPanelReady && !isUsingBuiltInAi();
  const conversation = getCurrentConversation();
  const continuesConversation = isContinuousConversationStep() && conversation
    && conversation.isContinuous && conversation.toolId === lab.selectedToolId;
  const onQuestionStep = isQuestionStep(student.step);
  byId("pasted-reply-field").hidden = !usesExternalTool;
  byId("copy-prompt-button").hidden = !usesExternalTool;
  byId("send-button").textContent = usesExternalTool ? "Registrar resposta" : "Enviar";
  byId("send-button").disabled = !lab.isPanelReady || lab.isSending;
  byId("prompt-label").textContent = continuesConversation ? "Sua mensagem" : "Seu prompt";
  byId("send-hint").textContent = usesExternalTool ? "" : "Ctrl+Enter também envia";
  placeComposer();
  byId("check-prompt-button").hidden = !onQuestionStep;
  byId("check-prompt-button").disabled = !lab.isPanelReady || lab.isSending || lab.isCheckingPrompt;
  if (!onQuestionStep) byId("prompt-check").hidden = true;
}

// Atualiza só a mensagem que está chegando, sem redesenhar o painel inteiro.
function updateStreamingReply(conversation) {
  const message = document.querySelector("#thread [data-streaming]");
  if (!message) return;
  message.innerHTML = conversation.partialReply ? formatAiText(conversation.partialReply) : WAITING_FOR_REPLY;
  scrollThreadToBottom();
}

// ---------- Envio ----------

function refreshAfterChange() {
  renderEvaluation();
  renderAiPanel();
}

function describeSendFailure(error) {
  const code = error && error.code;
  if (code === "not_granted") {
    lab.selectedToolId = DEFAULT_EXTERNAL_TOOL;
    return "O acesso à IA neste painel foi negado. Use uma das ferramentas da lista: abra-a em outra janela e cole a resposta aqui.";
  }
  if (code === "rate_limited") return "Limite de uso atingido ou muitos envios seguidos. Aguarde um pouco ou use outra ferramenta da lista.";
  return "Não foi possível gerar a resposta agora. Envie de novo." + (error && error.message ? " Detalhe técnico: " + error.message : "");
}

async function sendToBuiltInAi(rawText) {
  const text = (rawText || "").trim();
  if (!text || lab.isSending || !isUsingBuiltInAi()) return;
  lab.warningMessage = "";
  const questionKey = conversationKeyForCurrentStep();
  const isQuestion = isQuestionKey(questionKey);
  const conversation = findOrCreateConversation(questionKey, BUILT_IN_TOOL);
  const ownsAnswer = () => isQuestion && lab.answers[questionKey] && lab.answers[questionKey].conversationId === conversation.id;

  conversation.turns.push({ role: "user", content: text });
  conversation.isAwaitingReply = true;
  conversation.partialReply = "";
  lab.currentConversationId = conversation.id;
  if (isQuestion) lab.answers[questionKey] = createAnswer(text, "", false, conversation.id);
  lab.isSending = true;
  byId("prompt-input").value = "";
  setActiveView("ai");
  renderAiPanel();
  renderEvaluation();

  try {
    const history = conversation.turns.map(turn => ({ role: turn.role, content: turn.content }));
    const reply = await lab.askAi(history, {
      modelTier: "default",
      cache: false,
      onText: ({ text: partialText }) => {
        if (!partialText || partialText === THINKING_PLACEHOLDER) return;
        conversation.partialReply = partialText;
        if (lab.currentConversationId === conversation.id) updateStreamingReply(conversation);
      },
    });
    conversation.turns.push({ role: "assistant", content: reply.text });
    if (reply.modelApplied) conversation.model = reply.modelApplied;
    if (ownsAnswer()) {
      lab.answers[questionKey].response = reply.text;
      lab.answers[questionKey].isAnswered = true;
    }
  } catch (error) {
    conversation.turns.pop();
    lab.warningMessage = describeSendFailure(error);
    if (!conversation.turns.length) {
      removeConversation(conversation);
      if (ownsAnswer()) delete lab.answers[questionKey];
    }
    byId("prompt-input").value = text;
  } finally {
    conversation.isAwaitingReply = false;
    conversation.partialReply = "";
  }
  lab.isSending = false;
  refreshAfterChange();
}

// Com ferramenta externa, o aluno cola o prompt e a resposta que recebeu lá.
function registerExternalReply() {
  const prompt = byId("prompt-input").value.trim();
  const reply = byId("pasted-reply").value.trim();
  if (!prompt || !reply) return;
  lab.warningMessage = "";
  const questionKey = conversationKeyForCurrentStep();
  const conversation = findOrCreateConversation(questionKey, lab.selectedToolId);
  conversation.turns.push({ role: "user", content: prompt }, { role: "assistant", content: reply });
  lab.currentConversationId = conversation.id;
  if (isQuestionKey(questionKey)) lab.answers[questionKey] = createAnswer(prompt, reply, true, conversation.id);
  byId("prompt-input").value = "";
  byId("pasted-reply").value = "";
  refreshAfterChange();
}

export function fillPromptInput(text) {
  const input = byId("prompt-input");
  input.value = text;
  input.focus();
}

export function setupAiPanel() {
  byId("tab-guide").onclick = () => setActiveView("guide");
  byId("tab-ai").onclick = () => setActiveView("ai");
  byId("send-button").onclick = () => {
    if (isUsingBuiltInAi()) sendToBuiltInAi(byId("prompt-input").value);
    else registerExternalReply();
  };
  byId("prompt-input").addEventListener("keydown", event => {
    const isSendShortcut = event.key === "Enter" && (event.ctrlKey || event.metaKey);
    if (isSendShortcut && isUsingBuiltInAi()) {
      event.preventDefault();
      sendToBuiltInAi(byId("prompt-input").value);
    }
  });
  byId("copy-prompt-button").onclick = () => {
    const input = byId("prompt-input");
    if (input.value.trim()) copyFieldWithFeedback(input, byId("copy-prompt-button"));
  };
}

export function connectPanelToAi(askAi) {
  lab.askAi = askAi;
  lab.selectedToolId = askAi ? BUILT_IN_TOOL : DEFAULT_EXTERNAL_TOOL;
  lab.isPanelReady = true;
  renderAiPanel();
}
