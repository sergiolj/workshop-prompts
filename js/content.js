// Textos e dados fixos do laboratório: assuntos sugeridos, etapas, tipos de pergunta e ferramentas.

export const TOTAL_STEPS = 7;
const FIRST_QUESTION_STEP = 2;
export const SUMMARY_STEP = 6;
export const TEMPLATE_STEP = 7;

export const SUGGESTED_TOPICS = [
  "Trabalho remoto", "Dietas e emagrecimento", "Redes sociais e saúde mental",
  "Celular em sala de aula", "Ensino a distância", "Energia nuclear",
  "Linguagens de programação", "Inteligência artificial nos estudos",
  "Jogos eletrônicos e desempenho escolar",
];

export const STEP_TITLES = [
  "Assunto", "Pergunta neutra", "Pergunta direcionada", "Pergunta contextualizada",
  "Contextualizada, com checagem", "Quadro resumo", "Seu modelo",
];

// Os quatro tipos de pergunta, na ordem das etapas 2 a 5.
export const QUESTION_TYPES = {
  neutral: {
    name: "Neutra",
    description: "Pergunta aberta, sem conclusão e sem contexto.",
    typicalOutcome: "Costuma vir genérica, servindo para qualquer pessoa.",
    reminderTitle: "Pergunta neutra",
    reminderExample: "“O que se sabe sobre o horário de estudo e a memorização?”",
    reminderExplanation: "Não traz conclusão nem contexto. A resposta costuma servir para qualquer pessoa.",
    checkCriterion: "PERGUNTA NEUTRA: é uma pergunta aberta sobre o assunto, SEM conclusão embutida, SEM dizer quem é o aluno e SEM pedir formato, tamanho ou público.",
  },
  leading: {
    name: "Direcionada",
    description: "Já traz a conclusão dentro da pergunta.",
    typicalOutcome: "Tende a seguir a conclusão e mostrar só o lado que a confirma.",
    reminderTitle: "Pergunta direcionada",
    reminderExample: "“Explique por que estudar à noite rende mais.”",
    reminderExplanation: "A conclusão já está dentro da pergunta, e a IA tende a segui-la.",
    checkCriterion: "PERGUNTA DIRECIONADA: já traz uma conclusão dentro da pergunta (a afirmação do aluno) e pede que a IA explique por quê. Não pergunta se a afirmação é verdadeira.",
  },
  contextual: {
    name: "Contextualizada",
    description: "Diz quem você é, o que quer e como quer a resposta.",
    typicalOutcome: "Costuma vir mais específica e no formato que você pediu.",
    reminderTitle: "Pergunta contextualizada",
    reminderExample: "“Sou estudante de Enfermagem e tenho prova na sexta. Explique, em até 150 palavras e em linguagem simples, como o horário de estudo influencia a memorização.”",
    reminderExplanation: "Diz quem você é, o que precisa e como quer a resposta.",
    checkCriterion: "PERGUNTA CONTEXTUALIZADA: diz quem o aluno é, o que vai fazer com a resposta e como quer a resposta (tamanho, linguagem ou formato). Não precisa pedir outros lados nem fontes.",
  },
  verified: {
    name: "Com checagem",
    description: "Contextualizada, pedindo outros lados, limites e fontes.",
    typicalOutcome: "Tende a trazer pontos de vista diferentes e a indicar o que conferir.",
    reminderTitle: "Pergunta contextualizada, com checagem",
    reminderExample: "“Sou estudante de Enfermagem e tenho prova na sexta. Explique, em até 150 palavras, como o horário de estudo influencia a memorização. Mostre argumentos contrários, os limites das evidências e fontes que eu possa conferir.”",
    reminderExplanation: "Acrescenta o que você pede para poder confiar: outros lados, limites e fontes.",
    checkCriterion: "PERGUNTA CONTEXTUALIZADA COM CHECAGEM: tem o contexto (quem é, para quê, como quer) E pede também outros lados ou argumentos contrários, limites da evidência e fontes para conferir.",
  },
};
export const QUESTION_KEYS = Object.keys(QUESTION_TYPES);

// Conversas que não pertencem a uma das quatro perguntas.
export const TEMPLATE_CONVERSATION = "template";
export const FREE_CONVERSATION = "free";

export const VIEWPOINT_OPTIONS = ["Nenhum", "Algum", "Vários"];
export const CONFIDENCE_OPTIONS = [1, 2, 3, 4, 5];

// Ferramentas mais usadas no questionário (uso diário ou várias vezes por semana).
export const BUILT_IN_TOOL = "panel";
export const DEFAULT_EXTERNAL_TOOL = "gemini";
export const TOOLS = {
  panel: { name: "Neste painel (IA)", shortName: "Painel" },
  gemini: { name: "Gemini", shortName: "Gemini", url: "https://gemini.google.com" },
  chatgpt: { name: "ChatGPT", shortName: "ChatGPT", url: "https://chatgpt.com" },
  claude: { name: "Claude", shortName: "Claude.ai", url: "https://claude.ai" },
};

export function isQuestionStep(step) {
  return step >= FIRST_QUESTION_STEP && step < FIRST_QUESTION_STEP + QUESTION_KEYS.length;
}

export function questionKeyOfStep(step) {
  return QUESTION_KEYS[step - FIRST_QUESTION_STEP];
}

export function isQuestionKey(key) {
  return key in QUESTION_TYPES;
}
