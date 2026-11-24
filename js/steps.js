// Navegação entre as 7 etapas e a etapa 1 (assunto, curso e frase do aluno).
import {
  STEP_TITLES, SUGGESTED_TOPICS, SUMMARY_STEP, TEMPLATE_STEP, TOTAL_STEPS, isQuestionStep, questionKeyOfStep,
} from "./content.js";
import { byId, createButton, removeTrailingPunctuation, setPressed } from "./dom.js";
import { lab, student, isStudentProfileComplete, resetLab } from "./state.js";
import { fillPromptInput, renderAiPanel, setActiveView } from "./ai-panel.js";
import { renderEvaluation } from "./evaluation.js";
import { hidePromptCheck } from "./prompt-checker.js";
import { renderSummary } from "./summary.js";
import { clearStudyTemplate, prefillStudyTemplate, updateStudyTemplate } from "./study-template.js";

const LEADING_QUESTION_STEP = 3;
const VERIFIED_QUESTION_STEP = 5;
const PREVIOUS_STEP_PROMPT_KEY = "contextual";
const STUDENT_FIELDS = { topic: "topic", course: "course", belief: "belief" };

function showStep(step) {
  byId("workspace").dataset.step = step;
  document.querySelectorAll(".step").forEach(section => section.classList.remove("is-active"));
  byId("step-" + step).classList.add("is-active");
  byId("step-name").textContent = "Etapa " + step + " de " + TOTAL_STEPS + " · " + STEP_TITLES[step - 1];
  byId("progress-bar-fill").style.width = (step / TOTAL_STEPS * 100) + "%";
}

function showStudentTexts(step) {
  document.querySelectorAll(".topic-name").forEach(element => { element.textContent = student.topic.trim(); });
  if (step === LEADING_QUESTION_STEP) byId("belief-quote").textContent = "“" + removeTrailingPunctuation(student.belief) + ".”";
}

// Ao entrar numa etapa, o painel mostra a conversa daquela etapa.
function selectConversationForStep(step) {
  if (isQuestionStep(step)) {
    const answer = lab.answers[questionKeyOfStep(step)];
    lab.currentConversationId = answer ? answer.conversationId : null;
  } else if (step === TEMPLATE_STEP) {
    const lastContinuous = [...lab.conversations].reverse().find(conversation => conversation.isContinuous);
    lab.currentConversationId = lastContinuous ? lastContinuous.id : null;
  }
}

// Na etapa 5, oferece a pergunta contextualizada da etapa 4 como ponto de partida.
function showPreviousPrompt() {
  const previous = lab.answers[PREVIOUS_STEP_PROMPT_KEY];
  const prompt = previous && previous.prompt;
  byId("previous-prompt-box").hidden = !prompt;
  if (prompt) byId("previous-prompt").textContent = prompt;
}

export function goToStep(requestedStep) {
  // Sem assunto, curso e frase preenchidos, o aluno fica na etapa 1.
  const step = requestedStep > 1 && !isStudentProfileComplete() ? 1 : requestedStep;
  student.step = step;
  lab.warningMessage = "";
  hidePromptCheck();
  showStep(step);
  showStudentTexts(step);
  selectConversationForStep(step);
  if (step === VERIFIED_QUESTION_STEP) showPreviousPrompt();
  if (step === SUMMARY_STEP) renderSummary();
  if (step === TEMPLATE_STEP) {
    prefillStudyTemplate();
    updateStudyTemplate();
  }
  renderEvaluation();
  renderAiPanel();
  setActiveView("guide");
  window.scrollTo(0, 0);
}

// ---------- Etapa 1 ----------

function updateTopicSuggestions() {
  const topic = byId("topic").value.trim();
  document.querySelectorAll("#topic-suggestions .chip").forEach(chip => setPressed(chip, chip.textContent === topic));
}

function updateStartButton() {
  const allFilled = Object.values(STUDENT_FIELDS).every(id => byId(id).value.trim());
  byId("start-button").disabled = !allFilled;
}

function chooseSuggestedTopic(topic) {
  byId("topic").value = topic;
  student.topic = topic;
  updateTopicSuggestions();
  updateStartButton();
}

function setupProfileStep() {
  const suggestions = byId("topic-suggestions");
  SUGGESTED_TOPICS.forEach(topic => {
    const chip = createButton(topic, "chip", () => chooseSuggestedTopic(topic));
    setPressed(chip, false);
    suggestions.appendChild(chip);
  });
  Object.entries(STUDENT_FIELDS).forEach(([field, id]) => byId(id).addEventListener("input", () => {
    student[field] = byId(id).value;
    updateTopicSuggestions();
    updateStartButton();
  }));
  byId("start-button").onclick = () => goToStep(2);
}

// ---------- Recomeçar ----------

function restart() {
  resetLab();
  Object.values(STUDENT_FIELDS).forEach(id => { byId(id).value = ""; });
  clearStudyTemplate();
  byId("prompt-input").value = "";
  byId("pasted-reply").value = "";
  updateTopicSuggestions();
  updateStartButton();
  updateStudyTemplate();
  goToStep(1);
}

export function setupSteps() {
  setupProfileStep();
  document.addEventListener("click", event => {
    const link = event.target.closest("[data-go-to-step]");
    if (link && !link.disabled) goToStep(Number(link.dataset.goToStep));
  });
  byId("use-previous-prompt").onclick = () => {
    const previous = lab.answers[PREVIOUS_STEP_PROMPT_KEY];
    if (previous) fillPromptInput(previous.prompt);
  };
  byId("restart-button").onclick = restart;
}
