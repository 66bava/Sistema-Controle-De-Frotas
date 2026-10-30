export async function api(caminho, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch('/api' + caminho, {
      method,
      credentials: 'same-origin',
      headers: method !== 'GET' ? { 'Content-Type': 'application/json' } : {},
      body: method !== 'GET' ? JSON.stringify(body || {}) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error('Não foi possível conectar. Confira sua conexão e tente novamente.');
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Não foi possível processar a resposta. Tente novamente.');
  }
  if (!response.ok) {
    const error = new Error(data.mensagem || 'Não foi possível concluir a solicitação.');
    error.status = response.status;
    throw error;
  }
  return data;
}
export function feedback(message, kind = 'error') {
  const element = document.querySelector('#feedback');
  element.textContent = message;
  element.dataset.kind = kind;
  element.hidden = !message;
}
