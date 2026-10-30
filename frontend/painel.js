import { iniciarNavegacao, atalhosInicio } from './navegacao.js';
import { iniciarDashboard } from './dashboard.js';
import { iniciarUsuarios } from './usuarios.js';
import { iniciarPendencias } from './correcoesPendentes.js';
import { iniciarCadastros } from './cadastros.js';
import { api, feedback } from './api.js';
const body = document.querySelector('#pendentes');
const status = document.querySelector('#lista-status');
const atualizar = document.querySelector('#atualizar');
let carregando = false;
function tratarErro(error) {
  if (error.status === 401) {
    window.location.replace('/');
    return;
  }
  feedback(error.message);
}
function cell(text) {
  const td = document.createElement('td');
  td.textContent = text || '—';
  return td;
}
async function carregarPendentes() {
  if (carregando) return;
  carregando = true;
  atualizar.disabled = true;
  status.textContent = 'Carregando solicitações…';
  document.querySelector('#tabela-wrap').hidden = true;
  try {
    const { usuarios } = await api('/usuarios/pendentes');
    body.replaceChildren();
    for (const user of usuarios) {
      const tr = document.createElement('tr');
      const nome = cell(user.nome);
      const email = document.createElement('small');
      email.textContent = user.email;
      nome.append(email);
      const action = document.createElement('td');
      const button = document.createElement('button');
      button.className = 'approve-button';
      button.type = 'button';
      button.textContent = 'Aprovar acesso';
      button.setAttribute('aria-label', 'Aprovar acesso de ' + user.nome);
      button.addEventListener('click', async () => {
        button.disabled = true;
        button.textContent = 'Aprovando…';
        try {
          await api('/usuarios/' + user.id + '/aprovar', { method: 'POST' });
          feedback('Acesso de ' + user.nome + ' aprovado.', 'success');
          await carregarPendentes();
        } catch (error) {
          tratarErro(error);
          button.disabled = false;
          button.textContent = 'Aprovar acesso';
        }
      });
      action.append(button);
      tr.append(nome, cell(user.matricula), cell(user.funcao), action);
      body.append(tr);
    }
    status.textContent = usuarios.length
      ? usuarios.length + ' solicitação(ões) aguardando aprovação.'
      : 'Nenhuma solicitação pendente. Tudo em dia.';
    document.querySelector('#tabela-wrap').hidden = !usuarios.length;
  } catch (error) {
    status.textContent = 'Não foi possível carregar as solicitações.';
    tratarErro(error);
  } finally {
    carregando = false;
    atualizar.disabled = false;
  }
}
atualizar.addEventListener('click', () => {
  feedback('');
  carregarPendentes();
});
document.querySelector('#sair').addEventListener('click', async (event) => {
  event.currentTarget.disabled = true;
  try {
    await api('/auth/logout', { method: 'POST' });
    window.location.replace('/');
  } catch (error) {
    tratarErro(error);
    document.querySelector('#sair').disabled = false;
  }
});
try {
  const { usuario } = await api('/auth/sessao');
  document.querySelector('#boas-vindas').textContent = 'Olá, ' + usuario.nome.split(' ')[0] + '.';
  document.querySelector('#perfil').textContent = {
    admin: 'Administrador',
    driver: 'Condutor',
    viewer: 'Consulta',
  }[usuario.perfil];
  document.querySelector('#introducao').textContent =
    usuario.perfil === 'admin'
      ? 'Gerencie os acessos e os cadastros da frota.'
      : 'Seu ponto de partida para acompanhar os trajetos.';
  const solicitada = new URLSearchParams(window.location.search).get('secao');
  const secao =
    solicitada === 'correcoes' ||
    (usuario.perfil === 'admin' &&
      ['aprovacoes', 'usuarios', 'veiculos', 'setores'].includes(solicitada))
      ? solicitada
      : 'inicio';
  iniciarNavegacao(usuario, secao);
  if (secao === 'inicio') {
    document.querySelector('#inicio-panel').hidden = false;
    atalhosInicio(usuario);
    await iniciarDashboard(usuario);
  }
  if (secao === 'correcoes') {
    document.querySelector('#correcoes-panel').hidden = false;
    document.querySelector('#boas-vindas').textContent = 'Correções pendentes';
    document.querySelector('#introducao').textContent =
      'Confira as propostas que aguardam a assinatura do condutor.';
    await iniciarPendencias();
  }
  if (usuario.perfil === 'admin') {
    const loads = iniciarCadastros();
    if (secao === 'aprovacoes') {
      document.querySelector('#admin-panel').hidden = false;
      document.querySelector('#boas-vindas').textContent = 'Aprovar condutores';
      document.querySelector('#introducao').textContent =
        'Confira os cadastros e libere o acesso da equipe.';
      await carregarPendentes();
    } else if (secao === 'usuarios') {
      document.querySelector('#usuarios-panel').hidden = false;
      document.querySelector('#boas-vindas').textContent = 'Usuários';
      document.querySelector('#introducao').textContent =
        'Gerencie os perfis e os acessos da equipe.';
      await iniciarUsuarios(usuario);
    } else if (['veiculos', 'setores'].includes(secao)) {
      document.getElementById(secao + '-panel').hidden = false;
      document.querySelector('#boas-vindas').textContent =
        secao === 'veiculos' ? 'Veículos' : 'Setores';
      document.querySelector('#introducao').textContent =
        'Mantenha os cadastros da frota organizados.';
      await loads[secao]();
    }
  }
} catch (error) {
  document.querySelector('#boas-vindas').textContent = 'Não foi possível carregar sua conta.';
  document.querySelector('#introducao').textContent = 'Tente recarregar a página.';
  tratarErro(error);
}
