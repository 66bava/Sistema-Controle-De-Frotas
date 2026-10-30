import { baixarExcel } from './exportacaoExcel.js';
import { api, feedback } from './api.js';
const chaves = [
  'busca',
  'data_inicial',
  'data_final',
  'veiculo_id',
  'condutor_id',
  'setor_id',
  'status',
];
const q = (selector) => document.querySelector(selector);
const date = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
});
const time = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  timeStyle: 'short',
});
const datetime = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
});
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
function td(text) {
  const el = document.createElement('td');
  el.textContent = text ?? '—';
  return el;
}
function badge(item) {
  const span = document.createElement('span');
  span.className = 'status-badge';
  span.dataset.active = String(item.status === 'in_progress');
  span.textContent = item.status === 'in_progress' ? 'Em andamento' : 'Concluída';
  return span;
}
function erro(error) {
  if (error.status === 401) window.location.replace('/');
  else feedback(error.message);
}
export function criarHistorico(usuario, aoCarregar) {
  const params = new URLSearchParams(window.location.search);
  let filtros = Object.fromEntries(
    chaves.filter((key) => params.get(key)).map((key) => [key, params.get(key)])
  );
  let pagina = params.get('pagina') || '1',
    limite = params.get('limite') || '20',
    resultado,
    emCurso,
    opcoesCarregadas = false,
    exportando = false,
    carregando = false;
  const form = q('#historico-form');
  const exportar = q('#exportar-excel'),
    excelInfo = q('#excel-info');
  exportar.hidden = usuario.perfil !== 'admin';
  excelInfo.hidden = usuario.perfil !== 'admin';
  for (const key of chaves) if (form.elements[key]) form.elements[key].value = filtros[key] || '';
  if (![...q('#historico-limite').options].some((o) => o.value === limite)) {
    const o = new Option(limite, limite);
    q('#historico-limite').add(o);
  }
  q('#historico-limite').value = limite;
  q('#historico-condutor-group').hidden = usuario.perfil === 'driver';
  q('#historico-mais-filtros').open =
    !window.matchMedia('(max-width: 680px)').matches ||
    chaves.some((key) => key !== 'busca' && filtros[key]);
  function datas() {
    const de = q('#historico-data-inicial'),
      ate = q('#historico-data-final');
    ate.min = de.value;
    ate.setCustomValidity(
      de.value && ate.value && ate.value < de.value
        ? 'A data final não pode ser anterior à inicial.'
        : ''
    );
  }
  q('#historico-data-inicial').addEventListener('input', datas);
  q('#historico-data-final').addEventListener('input', datas);
  datas();
  function query() {
    const p = new URLSearchParams(filtros);
    if (Number(pagina) > 1) p.set('pagina', pagina);
    if (limite !== '20') p.set('limite', limite);
    return p;
  }
  function urlLista() {
    const text = query().toString();
    return '/ocorrencias.html' + (text ? '?' + text : '');
  }
  function urlDetalhe(id) {
    const p = query();
    p.set('id', String(id));
    return '/ocorrencias.html?' + p.toString();
  }
  function urlNova() {
    const p = query();
    p.set('nova', '1');
    return '/ocorrencias.html?' + p.toString();
  }
  function estadoExcel() {
    if (usuario.perfil !== 'admin') return;
    const alterado = chaves.some(
      (key) => (form.elements[key].value.trim() || '') !== (filtros[key] || '')
    );
    exportar.disabled = carregando || exportando || alterado || !resultado || resultado.total === 0;
    exportar.textContent = exportando ? 'Exportando…' : 'Exportar Excel';
    excelInfo.textContent = exportando
      ? 'Preparando todas as viagens dos filtros aplicados…'
      : alterado
        ? 'Há filtros alterados. Clique em Aplicar filtros antes de exportar.'
        : !resultado
          ? 'Carregue o histórico para exportar.'
          : resultado.total === 0
            ? 'Nenhuma viagem disponível para exportar.'
            : 'Exporta todas as ' +
              resultado.total +
              ' viagem(ns) dos filtros aplicados, incluindo as outras páginas.';
  }
  form.addEventListener('input', estadoExcel);
  form.addEventListener('change', estadoExcel);
  exportar.addEventListener('click', async () => {
    if (exportar.disabled || exportando) return;
    exportando = true;
    controles(carregando);
    feedback('');
    try {
      await baixarExcel(new URLSearchParams(filtros));
      feedback('Excel exportado com todos os resultados filtrados.', 'success');
    } catch (error) {
      if (error.name === 'TimeoutError' || error instanceof TypeError)
        feedback('Não foi possível exportar o Excel. Confira sua conexão e tente novamente.');
      else erro(error);
    } finally {
      exportando = false;
      controles(carregando);
    }
  });
  function controles(busy) {
    carregando = busy;
    busy = busy || exportando;
    for (const input of form.elements) input.disabled = busy;
    q('#historico-limite').disabled = busy;
    q('#atualizar-viagens').disabled = busy;
    q('#historico-anterior').disabled = busy || !resultado || resultado.pagina <= 1;
    q('#historico-proxima').disabled = busy || !resultado || resultado.pagina >= resultado.paginas;
    estadoExcel();
  }
  async function opcoes() {
    const data = await api('/ocorrencias/filtros');
    for (const [key, items, label] of [
      [
        'veiculo_id',
        data.veiculos,
        (item) =>
          item.modelo +
          ' · ' +
          item.placa +
          (item.excluido_em ? ' (arquivado)' : !item.ativo ? ' (inativo)' : ''),
      ],
      [
        'condutor_id',
        data.condutores,
        (item) => item.nome + (item.status !== 'active' ? ' (inativo)' : ''),
      ],
      ['setor_id', data.setores, (item) => item.nome + (!item.ativo ? ' (inativo)' : '')],
    ]) {
      const select = form.elements[key];
      while (select.options.length > 1) select.remove(1);
      for (const item of items) select.add(new Option(label(item), String(item.id)));
      if (filtros[key] && !items.some((item) => String(item.id) === filtros[key]))
        select.add(new Option('Seleção indisponível', filtros[key]));
      select.value = filtros[key] || '';
    }
    opcoesCarregadas = true;
  }
  function render(data) {
    const body = q('#historico-tabela'),
      cards = q('#viagens-lista');
    body.replaceChildren();
    cards.replaceChildren();
    for (const item of data.ocorrencias) {
      const row = document.createElement('tr'),
        code = td(''),
        link = document.createElement('a');
      link.href = urlDetalhe(item.id);
      link.textContent = item.codigo;
      code.append(link);
      const veiculo = td(item.modelo),
        placa = document.createElement('small');
      placa.textContent = item.placa;
      veiculo.append(placa);
      const status = td('');
      status.append(badge(item));
      row.append(
        code,
        td(date.format(new Date(item.saida_em))),
        veiculo,
        td(item.condutor),
        td(time.format(new Date(item.saida_em))),
        td(item.chegada_em ? datetime.format(new Date(item.chegada_em)) : '—'),
        td(item.distancia_km === null ? '—' : num.format(item.distancia_km) + ' km'),
        td(item.setor),
        status
      );
      body.append(row);
      const card = document.createElement('a');
      card.className = 'trip-card';
      card.href = urlDetalhe(item.id);
      const top = document.createElement('div');
      top.className = 'trip-card-top';
      const title = document.createElement('strong');
      title.textContent = item.codigo;
      top.append(title, badge(item));
      const vehicle = document.createElement('h3');
      vehicle.textContent = item.modelo + ' · ' + item.placa;
      card.append(top, vehicle);
      for (const value of [
        item.condutor + ' · ' + item.setor,
        'Saída: ' + datetime.format(new Date(item.saida_em)),
        'Chegada: ' +
          (item.chegada_em ? datetime.format(new Date(item.chegada_em)) : 'A registrar'),
        'Distância: ' +
          (item.distancia_km === null ? 'A registrar' : num.format(item.distancia_km) + ' km'),
        item.itinerario,
      ]) {
        const p = document.createElement('p');
        p.textContent = value;
        card.append(p);
      }
      const action = document.createElement('span');
      action.className = 'trip-card-action';
      action.textContent = 'Abrir ocorrência ↗';
      card.append(action);
      cards.append(card);
    }
    const inicio = data.total ? (data.pagina - 1) * data.limite + 1 : 0,
      fim = Math.min(data.pagina * data.limite, data.total);
    q('#lista-info').textContent = data.total
      ? 'Mostrando ' +
        inicio +
        '–' +
        fim +
        ' de ' +
        data.total +
        (data.total === 1 ? ' viagem.' : ' viagens.')
      : 'Nenhuma viagem encontrada para os filtros selecionados.';
    q('#historico-pagina').textContent = data.paginas
      ? 'Página ' + data.pagina + ' de ' + data.paginas
      : 'Sem resultados';
    q('#historico-filtros-ativos').textContent = Object.keys(filtros).length
      ? '(' + Object.keys(filtros).length + ' aplicado(s))'
      : '';
    q('#viagem-em-andamento').hidden = !data.em_andamento;
    if (data.em_andamento) {
      q('#viagem-atual-codigo').textContent = 'Viagem em andamento · ' + data.em_andamento.codigo;
      q('#abrir-viagem-atual').href = urlDetalhe(data.em_andamento.id);
    }
  }
  function carregar({ publicar = false, atualizarOpcoes = false } = {}) {
    if (emCurso) return emCurso;
    emCurso = (async () => {
      controles(true);
      q('#lista-info').textContent = 'Buscando viagens…';
      try {
        const [data] = await Promise.all([
          api('/ocorrencias?' + query().toString()),
          !opcoesCarregadas || atualizarOpcoes ? opcoes() : Promise.resolve(),
        ]);
        resultado = data;
        pagina = String(data.pagina);
        limite = String(data.limite);
        render(data);
        aoCarregar(data);
        if (publicar) window.history.replaceState(null, '', urlLista());
        return data;
      } catch (error) {
        q('#historico-tabela').replaceChildren();
        q('#viagens-lista').replaceChildren();
        q('#lista-info').textContent =
          'Não foi possível carregar o histórico. Confira os filtros e tente novamente.';
        resultado = null;
        throw error;
      } finally {
        controles(false);
        emCurso = null;
      }
    })();
    return emCurso;
  }
  async function buscar() {
    try {
      feedback('');
      await carregar({ publicar: true });
    } catch (error) {
      erro(error);
    }
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    filtros = Object.fromEntries(
      chaves
        .filter((key) => form.elements[key].value.trim())
        .map((key) => [key, form.elements[key].value.trim()])
    );
    pagina = '1';
    buscar();
  });
  q('#historico-limpar').addEventListener('click', () => {
    form.reset();
    filtros = {};
    pagina = '1';
    for (const key of chaves) form.elements[key].value = '';
    datas();
    buscar();
  });
  q('#historico-limite').addEventListener('change', () => {
    limite = q('#historico-limite').value;
    pagina = '1';
    buscar();
  });
  q('#historico-anterior').addEventListener('click', () => {
    pagina = String(Number(pagina) - 1);
    buscar();
  });
  q('#historico-proxima').addEventListener('click', () => {
    pagina = String(Number(pagina) + 1);
    buscar();
  });
  return { carregar, urlLista, urlDetalhe, urlNova };
}
