import { api, feedback } from './api.js';
const q = (id) => document.getElementById(id);
const perfis = { driver: 'Condutor', viewer: 'Consulta', admin: 'Administrador' },
  statuses = { active: 'Ativo', inactive: 'Inativo', pending: 'Aguardando aprovação' };
export async function iniciarUsuarios(usuario) {
  let pagina = 1,
    paginas = 0,
    busy = false,
    selecionado = null,
    salvando = false;
  const dialog = q('usuario-dialog');
  function erro(e) {
    if (e.status === 401) window.location.replace('/');
    else feedback(e.message);
  }
  async function carregar() {
    if (busy) return;
    busy = true;
    q('usuarios-info').textContent = 'Carregando usuários…';
    q('atualizar-usuarios').disabled = true;
    q('usuarios-anterior').disabled = true;
    q('usuarios-proxima').disabled = true;
    try {
      const params = new URLSearchParams(new FormData(q('usuarios-filtros')));
      params.set('pagina', pagina);
      const result = await api('/usuarios?' + params);
      pagina = result.pagina;
      paginas = result.paginas;
      q('usuarios-lista').replaceChildren();
      for (const item of result.usuarios) {
        const tr = document.createElement('tr');
        for (const valor of [
          item.nome,
          item.matricula || '—',
          item.funcao || '—',
          perfis[item.perfil],
          statuses[item.status],
        ]) {
          const td = document.createElement('td');
          td.textContent = valor;
          tr.append(td);
        }
        const email = document.createElement('small');
        email.textContent = item.email;
        tr.firstChild.append(email);
        const td = document.createElement('td');
        if (item.status === 'pending') {
          const a = document.createElement('a');
          a.href = '/painel.html?secao=aprovacoes';
          a.textContent = 'Abrir aprovações';
          td.append(a);
        } else if (item.id === usuario.id) {
          td.textContent = 'Sua conta';
        } else {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'secondary-button';
          button.textContent = 'Alterar acesso';
          button.setAttribute('aria-label', 'Alterar acesso de ' + item.nome);
          button.addEventListener('click', () => {
            selecionado = item;
            q('usuario-identificacao').textContent = item.nome + ' · ' + item.email;
            q('usuario-perfil').value = item.perfil;
            q('usuario-status').value = item.status;
            q('usuario-erro').hidden = true;
            dialog.showModal();
          });
          td.append(button);
        }
        tr.append(td);
        q('usuarios-lista').append(tr);
      }
      q('usuarios-info').textContent = result.total
        ? result.total + ' usuário(s) encontrado(s).'
        : 'Nenhum usuário encontrado.';
      q('usuarios-pagina').textContent = 'Página ' + pagina + ' de ' + Math.max(1, paginas);
    } catch (e) {
      q('usuarios-lista').replaceChildren();
      q('usuarios-info').textContent = 'Não foi possível carregar os usuários.';
      erro(e);
    } finally {
      busy = false;
      q('atualizar-usuarios').disabled = false;
      q('usuarios-anterior').disabled = pagina <= 1;
      q('usuarios-proxima').disabled = pagina >= paginas;
    }
  }
  q('usuarios-filtros').addEventListener('submit', (e) => {
    e.preventDefault();
    if (busy) return;
    pagina = 1;
    carregar();
  });
  q('atualizar-usuarios').addEventListener('click', carregar);
  q('usuarios-anterior').addEventListener('click', () => {
    if (!busy && pagina > 1) {
      pagina--;
      carregar();
    }
  });
  q('usuarios-proxima').addEventListener('click', () => {
    if (!busy && pagina < paginas) {
      pagina++;
      carregar();
    }
  });
  q('usuario-cancelar').addEventListener('click', () => {
    if (!salvando) dialog.close();
  });
  dialog.addEventListener('cancel', (e) => {
    if (salvando) e.preventDefault();
  });
  q('usuario-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (salvando || !selecionado) return;
    salvando = true;
    for (const el of q('usuario-form').elements) el.disabled = true;
    try {
      await api('/usuarios/' + selecionado.id + '/acesso', {
        method: 'PUT',
        body: { perfil: q('usuario-perfil').value, status: q('usuario-status').value },
      });
      dialog.close();
      feedback('Acesso de ' + selecionado.nome + ' atualizado.', 'success');
      await carregar();
    } catch (e) {
      if (e.status === 401) window.location.replace('/');
      q('usuario-erro').textContent = e.message;
      q('usuario-erro').hidden = false;
    } finally {
      salvando = false;
      for (const el of q('usuario-form').elements) el.disabled = false;
    }
  });
  await carregar();
}
