import { api, feedback } from './api.js';
function erroGlobal(error) {
  if (error.status === 401) window.location.replace('/');
  else feedback(error.message);
}
function td(text) {
  const node = document.createElement('td');
  node.textContent = text ?? '—';
  return node;
}
function statusCell(ativo) {
  const cell = td('');
  const badge = document.createElement('span');
  badge.className = 'status-badge';
  badge.dataset.active = String(ativo);
  badge.textContent = ativo ? 'Ativo' : 'Inativo';
  cell.append(badge);
  return cell;
}
function botao(label, nome, action, perigo = false) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.className = 'row-button' + (perigo ? ' danger-button' : '');
  b.setAttribute('aria-label', label + ' ' + nome);
  b.addEventListener('click', () => action(b));
  return b;
}
function configurar(tipo, singular) {
  const dialog = document.getElementById('dialog-' + singular);
  const form = document.getElementById('form-' + singular);
  const list = document.getElementById('lista-' + tipo);
  const status = document.getElementById('status-' + tipo);
  const search = document.getElementById('busca-' + tipo);
  const filter = document.getElementById('filtro-' + tipo);
  const refresh = document.getElementById('atualizar-' + tipo);
  const inline = document.getElementById('erro-' + singular);
  let registros = [],
    editando = null,
    salvando = false,
    carregando = false;
  function label(item) {
    return tipo === 'veiculos' ? item.modelo + ' · ' + item.placa : item.nome;
  }
  function abrir(item = null) {
    form.reset();
    editando = item;
    inline.hidden = true;
    inline.textContent = '';
    document.getElementById('titulo-' + singular).textContent =
      (item ? 'Editar ' : 'Novo ') + (singular === 'veiculo' ? 'veículo' : 'setor');
    for (const input of form.elements) {
      if (!input.name) continue;
      if (input.type === 'checkbox') input.checked = item ? Boolean(item[input.name]) : true;
      else input.value = item?.[input.name] ?? '';
    }
    dialog.showModal();
  }
  function render() {
    const term = search.value
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const visible = registros.filter((item) => {
      const text = (
        tipo === 'veiculos'
          ? [item.marca, item.modelo, item.placa, item.numero_interno]
          : [item.nome]
      )
        .join(' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      return (
        text.includes(term) &&
        (filter.value === 'todos' || item.ativo === (filter.value === 'ativos'))
      );
    });
    list.replaceChildren();
    for (const item of visible) {
      const row = document.createElement('tr');
      if (tipo === 'veiculos') {
        const vehicle = td(item.modelo);
        const marca = document.createElement('small');
        marca.textContent = item.marca;
        vehicle.append(marca);
        row.append(vehicle, td(item.placa), td(item.numero_interno));
      } else row.append(td(item.nome));
      row.append(statusCell(item.ativo));
      const actions = td('');
      actions.className = 'row-actions';
      actions.append(botao('Editar', label(item), () => abrir(item)));
      actions.append(
        botao(item.ativo ? 'Desativar' : 'Ativar', label(item), async (button) => {
          button.disabled = true;
          try {
            await api('/' + tipo + '/' + item.id, {
              method: 'PUT',
              body: { ...item, ativo: !item.ativo },
            });
            feedback('Status atualizado.', 'success');
            await carregar();
          } catch (error) {
            erroGlobal(error);
            button.disabled = false;
          }
        })
      );
      if (tipo === 'veiculos')
        actions.append(
          botao(
            'Arquivar',
            label(item),
            async (button) => {
              if (
                !window.confirm(
                  'Arquivar ' +
                    label(item) +
                    '? O veículo sairá dos cadastros disponíveis. O histórico será preservado.'
                )
              )
                return;
              button.disabled = true;
              try {
                await api('/veiculos/' + item.id, { method: 'DELETE' });
                feedback('Veículo arquivado. O histórico foi preservado.', 'success');
                await carregar();
              } catch (error) {
                erroGlobal(error);
                button.disabled = false;
              }
            },
            true
          )
        );
      row.append(actions);
      list.append(row);
    }
    status.textContent = visible.length
      ? visible.length +
        (visible.length === 1 ? ' cadastro encontrado.' : ' cadastros encontrados.')
      : registros.length
        ? 'Nenhum cadastro corresponde aos filtros.'
        : 'Nenhum cadastro por aqui. Use o botão acima para começar.';
  }
  async function carregar() {
    if (carregando) return;
    carregando = true;
    refresh.disabled = true;
    status.textContent = 'Carregando cadastros…';
    list.replaceChildren();
    try {
      const data = await api('/' + tipo);
      registros = data[tipo];
      render();
    } catch (error) {
      registros = [];
      status.textContent = 'Não foi possível carregar. Tente atualizar a lista.';
      erroGlobal(error);
    } finally {
      carregando = false;
      refresh.disabled = false;
    }
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (salvando) return;
    salvando = true;
    inline.hidden = true;
    form.setAttribute('aria-busy', 'true');
    for (const control of form.elements) control.disabled = true;
    const dados = {};
    for (const input of form.elements)
      if (input.name) dados[input.name] = input.type === 'checkbox' ? input.checked : input.value;
    try {
      await api('/' + tipo + (editando ? '/' + editando.id : ''), {
        method: editando ? 'PUT' : 'POST',
        body: dados,
      });
      dialog.close();
      feedback('Cadastro salvo com sucesso.', 'success');
      await carregar();
    } catch (error) {
      if (error.status === 401) {
        window.location.replace('/');
        return;
      }
      inline.textContent = error.message;
      inline.dataset.kind = 'error';
      inline.hidden = false;
    } finally {
      salvando = false;
      form.removeAttribute('aria-busy');
      for (const control of form.elements) control.disabled = false;
    }
  });
  document.getElementById('novo-' + singular).addEventListener('click', () => abrir());
  for (const id of ['fechar-', 'cancelar-'])
    document.getElementById(id + singular).addEventListener('click', () => {
      if (!salvando) dialog.close();
    });
  dialog.addEventListener('cancel', (event) => {
    if (salvando) event.preventDefault();
  });
  search.addEventListener('input', () => {
    if (!carregando) render();
  });
  filter.addEventListener('change', () => {
    if (!carregando) render();
  });
  refresh.addEventListener('click', () => {
    feedback('');
    carregar();
  });
  return carregar;
}
export function iniciarCadastros() {
  return { veiculos: configurar('veiculos', 'veiculo'), setores: configurar('setores', 'setor') };
}
