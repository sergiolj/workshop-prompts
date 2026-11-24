/* ===== CONFIGURAÇÃO: cole aqui o endereço do seu Worker da Cloudflare ===== */
// Se ficar vazio, a opção "Neste painel (IA)" não aparece e o verificador usa só as regras.
export const WORKER_URL = "https://lab-prompts.sergio-lopes.workers.dev";

// Tempo máximo de espera por uma resposta do Worker.
export const WORKER_TIMEOUT_MS = 90000;
