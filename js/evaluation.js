// Perguntas que o aluno responde depois de ler cada resposta da IA (etapas 2 a 5).
import { CONFIDENCE_OPTIONS, VIEWPOINT_OPTIONS, isQuestionStep, questionKeyOfStep } from "./content.js";
import { byId, createButton, createElement, setPressed } from "./dom.js";
import { lab, student, isAnswerRated } from "./state.js";
import { renderAiPanel } from "./ai-panel.js";

// Grupo de botões em que só um fica marcado; a escolha é gravada em answer[field].
function createChoiceGroup(questionKey, field, options) {
  const group = createElement("div", { className: "chip-group" });
  const answer = lab.answers[questionKey];
  options.forEach(option => {
    const button = createButton(String(option), "chip", () => {
      lab.answers[questionKey][field] = String(option);
      group.querySelectorAll(".chip").forEach(chip => setPressed(chip, chip === button));
      renderEvaluation();
    });
    setPressed(button, String(answer[field]) === String(option));
    group.appendChild(button);
  });
  return group;
}

function writeAnotherPrompt(questionKey) {
  delete lab.answers[questionKey];
  byId("evaluation-" + questionKey).innerHTML = "";
  renderEvaluation();
  renderAiPanel();
}

function createEvaluationForm(questionKey) {
  const form = createElement("div", { className: "evaluation" });
  const redoLine = createElement("p", { className: "evaluation-redo" });
  redoLine.appendChild(createButton("Escrever outro prompt", "button-link", () => writeAnotherPrompt(questionKey)));
  form.append(
    createElement("p", { className: "hint", text: "Leia a resposta ao lado e responda:" }),
    createElement("p", { className: "evaluation-question", text: "A resposta trouxe algum ponto de vista diferente da sua opinião?" }),
    createChoiceGroup(questionKey, "viewpoints", VIEWPOINT_OPTIONS),
    createElement("p", { className: "evaluation-question", text: "O quanto você confia nessa resposta?" }),
    createChoiceGroup(questionKey, "confidence", CONFIDENCE_OPTIONS),
    createElement("p", { className: "hint", text: "1 é não confio, 5 é confio totalmente." }),
    redoLine,
  );
  return form;
}

// Mostra o formulário quando a resposta chega e libera "Próxima etapa" quando ele estiver preenchido.
export function renderEvaluation() {
  const step = student.step;
  if (!isQuestionStep(step)) return;
  const questionKey = questionKeyOfStep(step);
  const container = byId("evaluation-" + questionKey);
  const answer = lab.answers[questionKey];
  if (answer && answer.isAnswered) {
    if (!answer.isEvaluationRendered) {
      container.replaceChildren(createEvaluationForm(questionKey));
      answer.isEvaluationRendered = true;
    }
  } else {
    container.innerHTML = answer ? '<p class="hint">A IA está respondendo ao lado…</p>' : "";
  }
  byId("next-button-step-" + step).disabled = !isAnswerRated(answer);
}
