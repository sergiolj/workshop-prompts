# Laboratório de prompts

Workshop autoguiado para avaliar a qualidade de prompts de IA. O aluno faz quatro tipos de pergunta à IA sobre o mesmo assunto, compara as respostas e termina com um modelo de prompt para usar nos estudos.

Leva cerca de 20 minutos e funciona no navegador do computador ou do celular. Não é preciso criar conta nem instalar nada.

## Acesse o laboratório

**https://sergiolj.github.io/workshop-prompts/**

Abra o endereço acima no navegador e siga as etapas descritas abaixo. A página é publicada pelo GitHub Pages a partir deste repositório.

> Quer publicar a sua própria cópia do laboratório? Veja o [config.md](config.md), com os passos usados na publicação (GitHub Pages, Cloudflare e Gemini).

## Como funciona

Depois de abrir https://sergiolj.github.io/workshop-prompts/, você verá uma tela com duas partes:

- **Roteiro** (à esquerda): as etapas do workshop, com instruções, exemplos e vídeos curtos.
- **IA** (à direita, a partir da etapa 2): onde você escreve e envia os prompts. No celular, alterne entre as duas pelas abas **Roteiro** e **IA** no topo.

Uma barra de progresso no topo mostra em que etapa você está. Use **Voltar** e **Próxima etapa** para navegar.

### Etapa 1. Comece pelo assunto
1. Assista ao vídeo "Veja antes de começar" (cerca de 1 minuto e meio).
2. Escolha um assunto nas sugestões ou escreva o seu.
3. Informe o seu curso.
4. Escreva uma frase que você acha verdadeira sobre o assunto. Ela será usada na etapa 3.
5. Clique em **Começar**.

### Etapas 2 a 5. As quatro perguntas
Em cada etapa você escreve um tipo de prompt sobre o mesmo assunto:

| Etapa | Tipo de pergunta | O que é |
|---|---|---|
| 2 | **Neutra** | Pergunta aberta, sem conclusão e sem contexto. |
| 3 | **Direcionada** | Já traz a sua frase da etapa 1 como conclusão e pede que a IA explique por quê. |
| 4 | **Contextualizada** | Diz quem você é, o que quer fazer com a resposta e como ela deve vir (tamanho, linguagem). |
| 5 | **Com checagem** | A contextualizada, pedindo também outros lados, limites e fontes. |

Em cada uma:
1. Escolha a ferramenta de IA no painel:
   - **Neste painel (IA)**: a resposta aparece ali mesmo, como uma conversa contínua.
   - **Gemini, ChatGPT ou Claude**: o laboratório abre a ferramenta em outra aba. Copie o prompt, envie lá e cole a resposta completa no campo **Resposta da sua ferramenta**.
2. Opcional: clique em **Verificar meu prompt** para receber um veredito e uma sugestão de melhoria antes de enviar.
3. Envie o prompt e leia a resposta.
4. Anote quantos pontos de vista diferentes a resposta trouxe (nenhum, algum ou vários) e a sua confiança nela (1 a 5).
5. Se esquecer o conceito, clique em **Lembrar o conceito do vídeo**.

Na etapa 5 você pode usar a pergunta contextualizada da etapa 4 como ponto de partida.

### Etapa 6. Quadro resumo
Assista ao vídeo "O que o laboratório mostra" (sem som, com textos na tela) e compare lado a lado os seus quatro prompts, as respostas e as suas notas. O laboratório destaca o que mudou entre elas, por exemplo:

- A IA acompanha o enquadramento da pergunta. Se o prompt já parte de uma conclusão, a resposta tende a confirmá-la.
- Resposta bem escrita parece resposta completa. Um lado só pode passar despercebido.
- Quem você é, o que quer e o que pede para checar mudam a resposta.

### Etapa 7. Seu modelo de prompt de estudo
Preencha quatro campos com algo que você está estudando agora:
1. Quem você é e em que ponto está.
2. O que você quer fazer com a resposta.
3. Como a resposta deve vir.
4. Como checar a resposta (erros comuns e incertezas, argumentos a favor e contra com fontes, ou pedir que a IA questione você).

O prompt é montado enquanto você escreve. Use **Copiar prompt** para levar a outra ferramenta ou **Testar no painel** para experimentar ali mesmo.

### Guardar o que você fez
Clique em **Copiar resumo em texto** e cole no Bloco de Notas, no Word ou no aplicativo de notas do celular. O resumo inclui os seus prompts, as respostas da IA, as suas notas e o modelo da etapa 7. Veja um exemplo em [resultado.txt](resultado.txt).

## Privacidade
Os prompts enviados ao painel ou ao verificador passam por um servidor do projeto (um Worker da Cloudflare) e por uma API de IA. O servidor não guarda nada. **Não escreva dados pessoais nos prompts.**

## Se algo não funcionar
- **A opção "Neste painel (IA)" não aparece ou a IA está indisponível**: a cota gratuita da IA pode ter acabado. Use o Gemini, o ChatGPT ou o Claude em outra aba. O verificador continua funcionando com regras automáticas.
- **O vídeo não abre**: atualize a página ou tente outro navegador.

## Arquivos do repositório
- `index.html`: a estrutura da página.
- `css/styles.css`: a aparência (cores, fontes e layout).
- `js/`: o funcionamento da página, em módulos:
  - `main.js`: ponto de entrada, liga as partes da página.
  - `config.js`: endereço do Worker da IA.
  - `content.js`: textos fixos (assuntos, etapas, tipos de pergunta, ferramentas).
  - `state.js`: estado da sessão do aluno (respostas e conversas).
  - `steps.js`: navegação entre as etapas e etapa 1.
  - `ai-panel.js`: painel de IA (ferramentas, conversas, envio).
  - `ai-client.js`: comunicação com o Worker.
  - `evaluation.js`: notas do aluno após cada resposta.
  - `prompt-checker.js` e `rule-checker.js`: "Verificar meu prompt", com IA e por regras.
  - `concept-reminder.js`: janela "Lembrar o conceito do vídeo".
  - `summary.js`: quadro resumo e resumo em texto.
  - `study-template.js`: modelo de prompt da etapa 7.
  - `dom.js`: funções auxiliares.
- `como-usar.mp4` e `o-que-mostra.mp4`: os vídeos das etapas 1 e 6.
- `worker/worker.js`: o servidor que liga a página à IA (Gemini ou Claude).
- `config.md`: passos usados para publicar o laboratório (GitHub Pages, Cloudflare e Gemini).
- `resultado.txt`: exemplo de resumo gerado ao final do workshop.
