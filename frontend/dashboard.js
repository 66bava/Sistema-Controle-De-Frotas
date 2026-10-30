import { api } from './api.js';
const q = (id) => document.getElementById(id);
const data = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
});
const numero = new Intl.NumberFormat('pt-BR');
export async function iniciarDashboard(usuario) {
  q('dashboard-escopo').textContent =
    usuario.perfil === 'driver'
      ? 'Indicadores e viagens da sua conta. Veículos ativos considera toda a frota.'
      : 'Indicadores e viagens de toda a frota.';
  let carregando = false;
  async function carregar() {
    if (carregando) return;
    carregando = true;
    q('atualizar-dashboard').disabled = true;
    q('dashboard-dados').setAttribute('aria-busy', 'true');
    q('dashboard-status').textContent = 'Carregando resumo…';
    try {
      const resumo = await api('/dashboard');
      for (const [chave, valor] of Object.entries(resumo.indicadores))
        q('indicador-' + chave).textContent = numero.format(valor);
      const lista = q('dashboard-recentes');
      lista.replaceChildren();
      for (const item of resumo.recentes) {
        const link = document.createElement('a');
        link.className = 'dashboard-viagem';
        link.href = '/ocorrencias.html?id=' + item.id;
        const titulo = document.createElement('strong');
        titulo.textContent = item.codigo + ' · ' + item.modelo + ' · ' + item.placa;
        const detalhe = document.createElement('span');
        detalhe.textContent = item.condutor + ' · ' + data.format(new Date(item.saida_em));
        const status = document.createElement('span');
        status.className = 'status-badge';
        status.dataset.active = String(item.status === 'in_progress');
        status.textContent = item.status === 'in_progress' ? 'Em andamento' : 'Concluída';
        link.append(titulo, detalhe, status);
        lista.append(link);
      }
      q('recentes-vazio').hidden = resumo.recentes.length !== 0;
      q('dashboard-dados').hidden = false;
      q('dashboard-status').textContent =
        'Atualizado em ' + data.format(new Date(resumo.atualizado_em)) + ' (Brasília).';
    } catch (error) {
      if (error.status === 401) window.location.replace('/');
      q('dashboard-status').textContent =
        'Não foi possível atualizar o resumo. Tente novamente.' +
        (q('dashboard-dados').hidden ? '' : ' Os dados exibidos são da última atualização.');
    } finally {
      carregando = false;
      q('atualizar-dashboard').disabled = false;
      q('dashboard-dados').setAttribute('aria-busy', 'false');
    }
  }
  q('atualizar-dashboard').addEventListener('click', carregar);
  await carregar();
}
