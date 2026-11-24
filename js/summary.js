// Etapa 6 (quadro resumo) e o resumo em texto que o aluno copia na etapa 7.
import { QUESTION_KEYS, QUESTION_TYPES, VIEWPOINT_OPTIONS } from "./content.js";
import { byId, copyToClipboard, escapeHtml } from "./dom.js";
import { lab, student } from "./state.js";

const HIGH_CONFIDENCE = 4;
const NOT_INFORMED = "–";

const answeredQuestionKeys = () => QUESTION_KEYS.filter(key => lab.answers[key] && lab.answers[key].isAnswered);
const questionLabel = key => "pergunta " + QUESTION_TYPES[key].name.toLowerCase();
const viewpointScore = key => VIEWPOINT_OPTIONS.indexOf(lab.answers[key].viewpoints);

/**
 * Uma observação sobre as notas do aluno: primeiro alerta para confiança alta numa resposta
 * sem pontos de vista diferentes; senão, compara onde ele viu mais e menos pontos de vista.
 */
function buildInsight() {
  const rated = answeredQuestionKeys().filter(key => lab.answers[key].viewpoints && lab.answers[key].confidence);
  const overconfident = rated.find(key => lab.answers[key].viewpoints === "Nenhum" && +lab.answers[key].confidence >= HIGH_CONFIDENCE);
  if (overconfident) {
    return `Na ${questionLabel(overconfident)} você deu confiança ${lab.answers[overconfident].confidence} a uma resposta sem nenhum ponto de vista diferente.`;
  }
  if (rated.length < 2) return "";
  const most = rated.reduce((best, key) => viewpointScore(key) > viewpointScore(best) ? key : best);
  const fewest = rated.reduce((worst, key) => viewpointScore(key) < viewpointScore(worst) ? key : worst);
  return viewpointScore(most) > viewpointScore(fewest)
    ? `Você viu mais pontos de vista diferentes na ${questionLabel(most)} do que na ${questionLabel(fewest)}.`
    : "Você viu uma quantidade parecida de pontos de vista diferentes nas suas respostas.";
}

function summaryTableRow(key) {
  const type = QUESTION_TYPES[key];
  const answer = lab.answers[key];
  const prompt = answer && answer.isAnswered ? `“${escapeHtml(answer.prompt)}”` : '<span class="muted">Não enviado</span>';
  const viewpoints = escapeHtml((answer && answer.viewpoints) || NOT_INFORMED);
  const confidence = escapeHtml((answer && answer.confidence) || NOT_INFORMED);
  return `<tr><td><b>${type.name}</b><div class="muted">${type.description}</div></td><td>${prompt}</td>`
    + `<td>Pontos de vista: ${viewpoints}<br>Confiança: ${confidence}</td><td>${type.typicalOutcome}</td></tr>`;
}

export function renderSummary() {
  if (!answeredQuestionKeys().length) {
    byId("summary-table").innerHTML = "<p>Você ainda não enviou nenhum prompt. Volte e faça as etapas anteriores.</p>";
    byId("summary-insight").innerHTML = "";
    return;
  }
  byId("summary-table").innerHTML = '<div class="table-scroll"><table class="summary-table">'
    + "<tr><th>Tipo de pergunta</th><th>Seu prompt</th><th>Suas notas</th><th>O que costuma acontecer</th></tr>"
    + QUESTION_KEYS.map(summaryTableRow).join("")
    + '</table></div><p class="hint summary-table-footnote">A última coluna descreve o que costuma acontecer. Compare com o que você marcou.</p>';
  const insight = buildInsight();
  byId("summary-insight").innerHTML = insight ? `<div class="note">${escapeHtml(insight)}</div>` : "";
}

// ---------- Resumo em texto ----------

const SEPARATOR = "-".repeat(40);
const sectionHeader = title => [SEPARATOR, title, SEPARATOR, ""];

function buildSummaryText() {
  const lines = [
    "LABORATÓRIO DE PROMPTS", "",
    `Assunto: ${student.topic.trim()}`, `Curso: ${student.course.trim()}`, `Minha afirmação: ${student.belief.trim()}`, "",
    ...sectionHeader("QUADRO RESUMO"),
  ];
  QUESTION_KEYS.forEach(key => {
    const type = QUESTION_TYPES[key];
    const answer = lab.answers[key];
    lines.push(
      `${type.name.toUpperCase()} (${type.description})`,
      `  Pontos de vista diferentes: ${(answer && answer.viewpoints) || NOT_INFORMED}`,
      `  Minha confiança (1 a 5): ${(answer && answer.confidence) || NOT_INFORMED}`,
      `  O que costuma acontecer: ${type.typicalOutcome}`, "",
    );
  });
  const insight = answeredQuestionKeys().length ? buildInsight() : "";
  if (insight) lines.push(`Observação: ${insight}`, "");
  QUESTION_KEYS.forEach(key => {
    const answer = lab.answers[key];
    lines.push(...sectionHeader(`PERGUNTA ${QUESTION_TYPES[key].name.toUpperCase()}`));
    if (answer && answer.isAnswered) lines.push("Meu prompt:", answer.prompt, "", "Resposta da IA:", answer.response, "");
    else lines.push("Não enviado.", "");
  });
  const studyTemplate = byId("template-output").value.trim();
  if (studyTemplate) lines.push(...sectionHeader("MEU MODELO DE PROMPT DE ESTUDO"), studyTemplate, "");
  return lines.join("\n");
}

async function copySummaryText() {
  const text = buildSummaryText();
  const textBox = byId("summary-text");
  const message = byId("summary-text-message");
  const button = byId("copy-summary");
  textBox.value = text;
  byId("summary-text-box").hidden = false;
  if (await copyToClipboard(text)) {
    message.textContent = "Resumo copiado. Cole no Bloco de Notas ou em outro aplicativo e salve como arquivo .txt, se quiser.";
    button.textContent = "Copiado";
  } else {
    textBox.focus();
    textBox.select();
    message.textContent = "Não consegui copiar sozinho. O texto está selecionado: use Ctrl+C (ou Cmd+C) e cole no seu aplicativo de notas.";
  }
  setTimeout(() => { button.textContent = "Copiar resumo em texto"; }, 2200);
}

export function setupSummary() {
  byId("copy-summary").onclick = copySummaryText;
}
