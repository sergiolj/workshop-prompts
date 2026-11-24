# Laboratório de prompts: como publicar no GitHub (gratuito)

Você vai usar três serviços gratuitos:
1. **GitHub Pages** hospeda a página (`index.html` e os dois vídeos).
2. **Cloudflare Workers** guarda a chave da IA e faz a ponte entre a página e a IA.
3. **Google AI Studio (Gemini)** é a IA que avalia os prompts e responde no painel.

A chave da IA fica só na Cloudflare. Ela nunca vai para o GitHub.

## Arquivos
- `index.html`: o laboratório.
- `como-usar.mp4` e `o-que-mostra.mp4`: os vídeos (precisam ficar na mesma pasta do `index.html`).
- `worker/worker.js`: o código do servidor (você cola na Cloudflare).

## Passo 1. Chave do Gemini
1. Entre em https://aistudio.google.com/apikey com a sua conta Google.
2. Clique em "Create API key" e copie a chave. Guarde-a, pois você vai colar no passo 3.
3. Confira, na própria página do AI Studio, os limites do seu plano gratuito e os termos de uso dos dados.

## Passo 2. Repositório no GitHub
1. No GitHub, clique em **New repository**. Nome sugerido: `laboratorio-de-prompts`.
2. Escolha **Public**. Contas gratuitas só publicam o GitHub Pages em repositório público. Não há problema: a chave não fica no código.
3. Marque "Add a README" e crie.
4. Clique em **Add file > Upload files** e envie `index.html`, `como-usar.mp4`, `o-que-mostra.mp4` e a pasta `worker`. Faça o commit.
5. Vá em **Settings > Pages**. Em "Build and deployment", escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`, e salve.
6. Aguarde 1 a 2 minutos. O endereço será `https://SEU-USUARIO.github.io/laboratorio-de-prompts/`.

## Passo 3. Worker na Cloudflare
1. Crie uma conta gratuita em https://dash.cloudflare.com.
2. Vá em **Workers & Pages > Create > Create Worker**, dê um nome (ex.: `lab-prompts`) e clique em **Deploy**.
3. Clique em **Edit code**, apague o exemplo, cole todo o conteúdo de `worker/worker.js` e clique em **Deploy**.
4. Vá em **Settings > Variables and Secrets** e adicione:
   - `ALLOWED_ORIGIN` (tipo Text): `https://SEU-USUARIO.github.io` (sem barra no final e sem o nome do repositório).
   - `GEMINI_API_KEY` (tipo **Secret**): a chave do passo 1.
5. Copie o endereço do Worker (algo como `https://lab-prompts.SEU-SUBDOMINIO.workers.dev`).

## Passo 4. Ligar a página ao Worker
1. No GitHub, abra `index.html`, clique no lápis (Edit) e procure a linha `const WORKER_URL="";`.
2. Cole o endereço do Worker entre as aspas e faça o commit.
3. Aguarde o GitHub Pages atualizar (1 a 2 minutos) e abra a página.

## Como saber se funcionou
- Na etapa 2, a lista de ferramentas deve mostrar **"Neste painel (IA)"**.
- Escreva um prompt e clique em **Verificar meu prompt**: deve aparecer o veredito com uma sugestão.
- Se a opção "Neste painel (IA)" não aparecer, o `WORKER_URL` está vazio. A página continua funcionando, com o verificador por regras e as ferramentas externas.
- Se aparecer erro, abra o Worker na Cloudflare e veja a aba **Logs**. Os motivos mais comuns são `ALLOWED_ORIGIN` diferente do endereço do site ou chave errada.

## Se a cota gratuita acabar
O Gemini gratuito tem limite diário. Quando acaba, a página avisa e o verificador usa as regras automaticamente. O painel de IA fica indisponível até a cota voltar.

## Usar o Claude em vez do Gemini
A API do Claude é paga por uso, e a conta gratuita do claude.ai não gera chave de API. Se você tiver crédito, crie uma chave em https://console.anthropic.com e adicione o segredo `ANTHROPIC_API_KEY` no Worker. Com esse segredo, o Worker passa a usar o Claude no lugar do Gemini. Não é preciso mudar mais nada.

## Modelo
Por padrão o Worker usa `gemini-flash-latest`. Para trocar, crie a variável `GEMINI_MODEL` (ou `CLAUDE_MODEL`) com o nome do modelo disponível na sua conta.

## Privacidade e ética
Os prompts dos alunos passam pelo seu Worker e pela API do Gemini. A página avisa isso ao aluno. O Worker não guarda nada. Se a pesquisa precisar de aprovação de comitê de ética, inclua esse fluxo no termo de consentimento.

## Limites de proteção do Worker
O Worker só aceita chamadas do site em `ALLOWED_ORIGIN`, limita o tamanho do texto e aceita até 20 pedidos por minuto por IP. Esse limite é aproximado. Para um controle rigoroso, use a regra de rate limiting da Cloudflare.
