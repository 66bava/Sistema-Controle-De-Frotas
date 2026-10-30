import { api } from './api.js';
export async function iniciarPendencias() {
  const q = (id) => document.getElementById(id);
  let busy = false;
  async function carregar() {
    if (busy) return;
    busy = true;
    q('atualizar-correcoes').disabled = true;
    q('correcoes-status').textContent = 'Carregando propostas…';
    q('correcoes-lista').replaceChildren();
    try {
      const { correcoes } = await api('/ocorrencias/correcoes-pendentes');
      for (const item of correcoes) {
        const a = document.createElement('a');
        a.className = 'dashboard-viagem';
        a.href = '/ocorrencias.html?id=' + item.ocorrencia_id;
        const title = document.createElement('strong');
        title.textContent =
          'OC-' + String(item.ocorrencia_id).padStart(6, '0') + ' · ' + item.condutor;
        const p = document.createElement('span');
        p.textContent = item.justificativa;
        a.append(title, p);
        q('correcoes-lista').append(a);
      }
      q('correcoes-status').textContent = correcoes.length
        ? correcoes.length +
          ' proposta(s) aguardando assinatura. Exibindo até 200 propostas; o histórico completo está nos detalhes de cada viagem.'
        : 'Nenhuma correção pendente.';
    } catch (e) {
      if (e.status === 401) window.location.replace('/');
      q('correcoes-status').textContent =
        'Não foi possível carregar as correções. Tente atualizar.';
    } finally {
      busy = false;
      q('atualizar-correcoes').disabled = false;
    }
  }
  q('atualizar-correcoes').addEventListener('click', carregar);
  await carregar();
}
