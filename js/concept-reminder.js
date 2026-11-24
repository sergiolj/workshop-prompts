// Janela "Lembrar o conceito do vídeo", com o exemplo de cada tipo de pergunta.
import { QUESTION_TYPES } from "./content.js";
import { byId, escapeHtml } from "./dom.js";

let elementFocusedBeforeOpening = null;

function openConceptReminder(questionKey) {
  const type = QUESTION_TYPES[questionKey];
  byId("modal").innerHTML = `<h3 id="modal-title">${escapeHtml(type.reminderTitle)}</h3>`
    + `<p>${escapeHtml(type.description)}</p>`
    + `<p class="hint modal-example-intro">Exemplo do vídeo, com o assunto horário de estudo:</p>`
    + `<div class="modal-example">${escapeHtml(type.reminderExample)}</div>`
    + `<p>${escapeHtml(type.reminderExplanation)}</p>`
    + `<div class="button-row"><button type="button" id="modal-close">Entendi</button></div>`;
  elementFocusedBeforeOpening = document.activeElement;
  byId("modal-overlay").hidden = false;
  byId("modal-close").focus();
  byId("modal-close").onclick = closeConceptReminder;
}

function closeConceptReminder() {
  byId("modal-overlay").hidden = true;
  if (elementFocusedBeforeOpening) elementFocusedBeforeOpening.focus();
}

export function setupConceptReminder() {
  document.addEventListener("click", event => {
    const trigger = event.target.closest("[data-concept]");
    if (trigger) {
      openConceptReminder(trigger.dataset.concept);
      return;
    }
    if (event.target.id === "modal-overlay") closeConceptReminder();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !byId("modal-overlay").hidden) closeConceptReminder();
  });
}
