// Verificador de prompt por regras: funciona sem IA, olhando só a estrutura da pergunta.
import {
  normalizeText, lowercaseFirstLetter, ensureEndsWithPunctuation, joinWithAnd,
} from "./dom.js";

export const VERDICT = { YES: "SIM", ALMOST: "QUASE", NO: "NAO" };

// Padrões procurados no texto já normalizado (minúsculo e sem acentos).
const PATTERNS = {
  saysWhoTheStudentIs: /\b(sou|estou|estudante|aluno|aluna|graduando|graduanda|cursando|universitari[oa]|iniciante|professor|professora)\b|\bmeu curso\b|\bfaco (o )?curso\b/,
  saysPurpose: /\b(preciso|vou|quero|gostaria|prova|trabalho|seminario|apresentacao|estudar|revisar|entender|aprender|debate|debater|montar|preparar)\b|\bpara (estudar|a prova|um trabalho|entender|aprender|apresentar|revisar)\b/,
  asksFormat: /\bate \d+ |\b\d+ (palavras|linhas|paragrafos|topicos|itens|exemplos)\b|\bem (poucas |\d+ )?(linhas|palavras|topicos|paragrafos)\b|linguagem (simples|clara|acessivel|tecnica)|\bresum[oa]r?\b|topicos|\blista\b|\btabela\b|passo a passo|\bexemplos?\b|\bobjetiv[oa]\b|\bcurt[oa]\b|de forma (simples|objetiva|curta)/,
  asksOtherSides: /outros? lados?|lado contrario|argumentos? contrari|contra-?argument|pontos? de vista|perspectivas?|\bcriticas?\b|a favor e contra|ambos os lados|dois lados|vantagens e desvantagens|\bdiscord/,
  asksLimits: /\blimit(es|acoes|e)\b|incerteza|ressalvas?|nivel de evidencia|evidencias? (fraca|forte)|ate onde|excecoes|lacunas|o que (ainda )?nao se sabe/,
  asksSources: /\bfontes?\b|\breferencias?\b|bibliograf|\blinks?\b|citac|\bautores?\b/,
  asksWhy: /\b(por ?que|justifique|explique|mostre|prove|comprove|confirme)\b/,
  asksToJustifyConclusion: /explique por ?que|justifique|mostre por ?que|prove que|comprove que|confirme que|por que (nao )?(e|eh)/,
  statesIntention: /\b(preciso|quero|vou)\b/,
};

const VERIFICATION_REQUESTS = [
  { found: "asksOtherSides", wording: "argumentos contrários" },
  { found: "asksLimits", wording: "os limites das evidências" },
  { found: "asksSources", wording: "fontes que eu possa conferir" },
];

// Fração das palavras da frase do aluno que precisa aparecer para contar como "conclusão embutida".
const NEUTRAL_MAX_BELIEF_OVERLAP = 0.6;
const LEADING_MIN_BELIEF_OVERLAP = 0.5;
const NEUTRAL_MIN_WORDS = 3;
const CONTEXTUAL_MIN_WORDS = 6;
const MIN_VERIFICATION_REQUESTS = 2;

const significantWords = text => normalizeText(text).split(/[^a-z0-9]+/).filter(word => word.length >= 4);
const countTrue = flags => Object.values(flags).filter(Boolean).length;

function analyzePrompt(promptText, student) {
  const text = promptText.trim();
  const normalized = normalizeText(text);
  const beliefWords = [...new Set(significantWords(student.belief))];
  const topicWords = significantWords(student.topic);
  const context = {
    who: PATTERNS.saysWhoTheStudentIs.test(normalized),
    purpose: PATTERNS.saysPurpose.test(normalized),
    format: PATTERNS.asksFormat.test(normalized),
  };
  const verification = {
    asksOtherSides: PATTERNS.asksOtherSides.test(normalized),
    asksLimits: PATTERNS.asksLimits.test(normalized),
    asksSources: PATTERNS.asksSources.test(normalized),
  };
  return {
    text,
    normalized,
    wordCount: text.split(/\s+/).length,
    hasBelief: beliefWords.length > 0,
    beliefOverlap: beliefWords.length ? beliefWords.filter(word => normalized.includes(word)).length / beliefWords.length : 0,
    mentionsTopic: !topicWords.length || topicWords.some(word => normalized.includes(word)),
    context,
    contextCount: countTrue(context),
    verification,
    verificationCount: countTrue(verification),
  };
}

function checkNeutral(prompt, student) {
  const hasConclusion = prompt.beliefOverlap >= NEUTRAL_MAX_BELIEF_OVERLAP || PATTERNS.asksToJustifyConclusion.test(prompt.normalized);
  const hasContext = prompt.context.who || prompt.context.format || PATTERNS.statesIntention.test(prompt.normalized);
  let result;
  if (prompt.wordCount < NEUTRAL_MIN_WORDS) result = [VERDICT.NO, "O texto está curto demais para ser uma pergunta sobre o assunto."];
  else if (hasConclusion) result = [VERDICT.NO, "A pergunta já traz uma conclusão ou pede para justificar algo. Na neutra, pergunte de forma aberta."];
  else if (hasContext) result = [VERDICT.ALMOST, "Há contexto na pergunta (quem você é, formato ou objetivo). Na neutra, deixe isso de fora."];
  else if (!prompt.mentionsTopic) result = [VERDICT.ALMOST, "A pergunta não parece citar o assunto escolhido."];
  else result = [VERDICT.YES, "É uma pergunta aberta, sem conclusão e sem contexto."];
  const [verdict, reason] = result;
  const suggestion = `O que se sabe sobre ${lowercaseFirstLetter(student.topic.trim())}?`;
  return { verdict, reason, suggestion: verdict === VERDICT.YES ? "" : suggestion };
}

function checkLeading(prompt, student) {
  const asksWhy = PATTERNS.asksWhy.test(prompt.normalized);
  const containsBelief = prompt.beliefOverlap >= LEADING_MIN_BELIEF_OVERLAP;
  let result;
  if (!prompt.hasBelief) {
    result = [VERDICT.ALMOST, asksWhy
      ? "Confira se a sua frase da etapa 1 aparece como conclusão na pergunta."
      : "Traga a sua frase como conclusão e peça à IA que explique por quê."];
  } else if (containsBelief && asksWhy) result = [VERDICT.YES, "A sua frase aparece como conclusão e a pergunta pede uma explicação."];
  else if (containsBelief) result = [VERDICT.ALMOST, "A sua frase aparece, mas falta pedir que a IA explique por quê."];
  else result = [VERDICT.NO, "A sua frase da etapa 1 não aparece como conclusão dentro da pergunta."];
  const [verdict, reason] = result;
  const belief = student.belief.trim().replace(/[.!?]+$/, "");
  return { verdict, reason, suggestion: verdict === VERDICT.YES ? "" : `Explique por que ${lowercaseFirstLetter(belief)}.` };
}

function missingContextDescriptions(context) {
  const missing = [];
  if (!context.who) missing.push("quem você é");
  if (!context.purpose) missing.push("o que vai fazer com a resposta");
  if (!context.format) missing.push("como quer a resposta (tamanho ou linguagem)");
  return missing;
}

function checkContextual(prompt) {
  const missing = joinWithAnd(missingContextDescriptions(prompt.context));
  if (prompt.wordCount < CONTEXTUAL_MIN_WORDS) return { verdict: VERDICT.NO, reason: "O texto está curto demais para ter contexto." };
  if (prompt.contextCount < 2) return { verdict: VERDICT.NO, reason: "Falta contexto: " + missing + "." };
  if (prompt.contextCount < 3) return { verdict: VERDICT.ALMOST, reason: "Falta dizer " + missing + "." };
  return { verdict: VERDICT.YES, reason: "Tem quem você é, o que quer fazer e como quer a resposta." };
}

function missingVerificationWording(prompt) {
  return joinWithAnd(VERIFICATION_REQUESTS.filter(request => !prompt.verification[request.found]).map(request => request.wording));
}

function checkVerified(prompt) {
  let { verdict, reason } = checkContextual(prompt);
  if (prompt.verificationCount < MIN_VERIFICATION_REQUESTS) {
    if (verdict === VERDICT.YES) verdict = prompt.verificationCount === 0 ? VERDICT.NO : VERDICT.ALMOST;
    reason += " Falta pedir a checagem: " + missingVerificationWording(prompt) + ".";
  } else if (verdict === VERDICT.YES) {
    reason = "Tem o contexto e pede checagem (outros lados, limites ou fontes).";
  }
  return { verdict, reason };
}

// Completa o prompt do aluno com o que faltou de contexto (e de checagem, na pergunta com checagem).
function suggestWithContext(questionKey, prompt, student) {
  let suggestion = ensureEndsWithPunctuation(prompt.text);
  if (!prompt.context.who) suggestion = `Sou estudante de ${student.course.trim()}. ` + suggestion;
  if (!prompt.context.purpose) suggestion += " Vou usar a resposta para estudar.";
  if (!prompt.context.format) suggestion += " Responda em até 150 palavras e em linguagem simples.";
  if (questionKey === "verified" && prompt.verificationCount < MIN_VERIFICATION_REQUESTS) {
    suggestion += " Mostre também " + missingVerificationWording(prompt) + ".";
  }
  return suggestion;
}

/**
 * Avalia se o prompt se enquadra no tipo de pergunta.
 * student traz {topic, course, belief}. Devolve {verdict, reason, suggestion}.
 */
export function checkPromptByRules(questionKey, promptText, student) {
  const prompt = analyzePrompt(promptText, student);
  if (questionKey === "neutral") return checkNeutral(prompt, student);
  if (questionKey === "leading") return checkLeading(prompt, student);
  const { verdict, reason } = questionKey === "verified" ? checkVerified(prompt) : checkContextual(prompt);
  const suggestion = verdict === VERDICT.YES ? "" : suggestWithContext(questionKey, prompt, student);
  return { verdict, reason, suggestion };
}
