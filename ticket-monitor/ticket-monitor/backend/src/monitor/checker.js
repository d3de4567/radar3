// monitor/checker.js
//
// Este módulo é responsável por UMA ÚNICA TAREFA: visitar a página do evento
// e decidir se ela indica "esgotado" ou "disponível".
//
// IMPORTANTE - LEIA ISTO:
// Este sistema NÃO tenta comprar ingressos, NÃO tenta burlar CAPTCHA, fila
// virtual, login ou qualquer proteção do site. Ele apenas faz uma requisição
// HTTP simples (o mesmo tipo de requisição que o seu navegador faz para
// carregar a página) e procura por palavras/indícios no HTML retornado.
//
// Como cada site de venda de ingressos é feito de um jeito diferente, não
// existe uma forma 100% genérica e confiável de detectar disponibilidade.
// Por isso o sistema permite que você personalize, por evento, quais textos
// indicam "esgotado" e quais indicam "disponível" (campos sold_out_text e
// available_text). Se você não informar nada, usamos uma lista padrão de
// palavras comuns em português e inglês.
//
// Se o site carregar a disponibilidade via JavaScript/API (comum em sites
// modernos como o ARQZIN), a requisição simples pode não conseguir ver esse
// conteúdo, porque ele só aparece depois que o JavaScript roda no navegador.
// Nesse caso, o status ficará como "unknown" e o histórico vai mostrar isso -
// é um sinal de que vale a pena inspecionar a aba "Rede" do navegador
// (explicado no README) para descobrir o endereço da API que o site usa, e
// depois preencher esse endereço no campo "URL" do evento em vez da página
// HTML.

const fetch = require('node-fetch');

const DEFAULT_SOLD_OUT_PATTERNS = [
  'esgotado',
  'esgotados',
  'sem ingressos',
  'ingressos esgotados',
  'indisponível',
  'indisponivel',
  'sold out',
  'unavailable',
  'not available',
];

const DEFAULT_AVAILABLE_PATTERNS = [
  'comprar ingresso',
  'comprar agora',
  'adicionar ao carrinho',
  'disponível',
  'disponivel',
  'buy now',
  'add to cart',
  'get tickets',
];

const REQUEST_TIMEOUT_MS = 15000;
const USER_AGENT =
  'Mozilla/5.0 (compatible; MonitorDeIngressosPessoal/1.0; +uso-pessoal-nao-comercial)';

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
      },
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // remove acentos para comparar
}

function containsAny(haystack, patterns) {
  const normalizedHaystack = normalize(haystack);
  return patterns.some((p) => normalizedHaystack.includes(normalize(p)));
}

/**
 * Decide o status a partir do HTML/JSON retornado pela página.
 * Retorna: 'available' | 'sold_out' | 'unknown'
 */
function determineAvailability(rawBody, event) {
  const soldOutPatterns = event.sold_out_text
    ? event.sold_out_text.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_SOLD_OUT_PATTERNS;

  const availablePatterns = event.available_text
    ? event.available_text.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_AVAILABLE_PATTERNS;

  const hasSoldOut = containsAny(rawBody, soldOutPatterns);
  const hasAvailable = containsAny(rawBody, availablePatterns);

  // Regra: se o texto de "esgotado" aparece, priorizamos esgotado (é o
  // indicador mais explícito). Só marcamos disponível se houver sinal de
  // compra E não houver sinal de esgotado.
  if (hasSoldOut) return 'sold_out';
  if (hasAvailable) return 'available';
  return 'unknown';
}

/**
 * Executa uma verificação única para um evento.
 * Retorna { status, httpStatus, error }
 */
async function checkEvent(event) {
  try {
    const response = await fetchWithTimeout(event.url);
    const httpStatus = response.status;

    if (httpStatus === 429) {
      return {
        status: 'error',
        error: 'O site respondeu "muitas requisições" (429). Aumente o intervalo deste evento.',
        httpStatus,
      };
    }

    if (!response.ok) {
      return {
        status: 'error',
        error: `O site respondeu com erro HTTP ${httpStatus}.`,
        httpStatus,
      };
    }

    const body = await response.text();
    const status = determineAvailability(body, event);

    return { status, httpStatus };
  } catch (err) {
    const message =
      err.name === 'AbortError'
        ? 'Tempo de resposta esgotado ao tentar acessar a página.'
        : err.message;
    return { status: 'error', error: message };
  }
}

module.exports = { checkEvent, determineAvailability };
