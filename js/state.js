// Estado da sessão do aluno. Fica só na memória da página: recarregar apaga tudo.
import { BUILT_IN_TOOL, DEFAULT_EXTERNAL_TOOL, TEMPLATE_STEP } from "./content.js";

export const student = { topic: "", course: "", belief: "", step: 1 };

export const lab = {
  // Respostas das quatro perguntas, por tipo (neutral, leading, contextual, verified).
  answers: {},
  conversations: [],
  currentConversationId: null,
  lastConversationId: 0,
  // Função que envia mensagens à IA do painel, ou null se o painel não tiver IA.
  askAi: null,
  isPanelReady: false,
  isSending: false,
  isCheckingPrompt: false,
  selectedToolId: DEFAULT_EXTERNAL_TOOL,
  warningMessage: "",
};

export function isStudentProfileComplete() {
  return Boolean(student.topic.trim() && student.course.trim() && student.belief.trim());
}

export function isUsingBuiltInAi() {
  return lab.selectedToolId === BUILT_IN_TOOL && Boolean(lab.askAi);
}

// Só na etapa 7 a conversa é contínua; nas outras, cada envio abre uma conversa nova.
export function isContinuousConversationStep() {
  return student.step === TEMPLATE_STEP;
}

export function getCurrentConversation() {
  return lab.conversations.find(conversation => conversation.id === lab.currentConversationId) || null;
}

function createConversation(questionKey, toolId) {
  const conversation = {
    id: ++lab.lastConversationId,
    questionKey,
    toolId,
    turns: [],
    isContinuous: isContinuousConversationStep(),
    isAwaitingReply: false,
    partialReply: "",
    model: "",
  };
  lab.conversations.push(conversation);
  return conversation;
}

// A conversa contínua da etapa 7 é reaproveitada enquanto o aluno usar a mesma ferramenta.
export function findOrCreateConversation(questionKey, toolId) {
  const current = getCurrentConversation();
  const canContinue = isContinuousConversationStep() && current && current.isContinuous && current.toolId === toolId;
  return canContinue ? current : createConversation(questionKey, toolId);
}

export function removeConversation(conversation) {
  lab.conversations = lab.conversations.filter(other => other !== conversation);
  if (lab.currentConversationId === conversation.id) lab.currentConversationId = null;
}

export function createAnswer(prompt, response, isAnswered, conversationId) {
  return { prompt, response, isAnswered, isEvaluationRendered: false, viewpoints: "", confidence: "", conversationId };
}

export function isAnswerRated(answer) {
  return Boolean(answer && answer.isAnswered && answer.viewpoints && answer.confidence);
}

export function resetLab() {
  lab.answers = {};
  lab.conversations = [];
  lab.currentConversationId = null;
  lab.lastConversationId = 0;
  lab.warningMessage = "";
  student.topic = student.course = student.belief = "";
}
