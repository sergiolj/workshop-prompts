// Ponto de entrada: liga cada parte da página e abre a etapa 1.
import { connectToAi } from "./ai-client.js";
import { connectPanelToAi, setupAiPanel } from "./ai-panel.js";
import { setupConceptReminder } from "./concept-reminder.js";
import { checkCurrentPrompt } from "./prompt-checker.js";
import { goToStep, setupSteps } from "./steps.js";
import { setupStudyTemplate, updateStudyTemplate } from "./study-template.js";
import { setupSummary } from "./summary.js";
import { byId } from "./dom.js";

setupSteps();
setupAiPanel();
setupConceptReminder();
setupSummary();
setupStudyTemplate();
byId("check-prompt-button").onclick = checkCurrentPrompt;

updateStudyTemplate();
goToStep(1);
connectToAi().then(connectPanelToAi);
