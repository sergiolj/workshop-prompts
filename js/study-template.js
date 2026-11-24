// Etapa 7: o aluno monta um modelo de prompt para usar nos estudos.
import { byId, copyFieldWithFeedback } from "./dom.js";
import { student } from "./state.js";
import { fillPromptInput, setActiveView } from "./ai-panel.js";

const TEXT_FIELD_IDS = ["template-who", "template-goal", "template-format"];

export function prefillStudyTemplate() {
  const whoField = byId("template-who");
  if (!whoField.value) whoField.value = `Sou estudante de ${student.course.trim()}.`;
}

function verificationHint(verificationSelect) {
  const startsDialogue = verificationSelect.selectedOptions[0].hasAttribute("data-starts-dialogue");
  return startsDialogue
    ? "Com esta opção a IA faz perguntas. A conversa continua: você responde no painel e ela segue de onde parou."
    : "A IA responde uma vez. Se quiser aprofundar, continue a conversa no painel: nesta etapa ela lembra do que já foi dito.";
}

// Junta os campos preenchidos e acrescenta o pedido de checagem escolhido.
export function updateStudyTemplate() {
  const verificationSelect = byId("template-verification");
  const filledParts = TEXT_FIELD_IDS.map(id => byId(id).value.trim()).filter(Boolean);
  byId("template-output").value = filledParts.length ? filledParts.join(" ") + " " + verificationSelect.value : "";
  byId("template-verification-hint").textContent = verificationHint(verificationSelect);
}

export function clearStudyTemplate() {
  TEXT_FIELD_IDS.forEach(id => { byId(id).value = ""; });
}

export function setupStudyTemplate() {
  [...TEXT_FIELD_IDS, "template-verification"].forEach(id => byId(id).addEventListener("input", updateStudyTemplate));
  byId("template-verification").addEventListener("change", updateStudyTemplate);
  byId("copy-template").onclick = () => {
    const output = byId("template-output");
    if (output.value) copyFieldWithFeedback(output, byId("copy-template"));
  };
  byId("try-template").onclick = () => {
    const output = byId("template-output");
    if (!output.value) return;
    setActiveView("ai");
    fillPromptInput(output.value);
  };
}
