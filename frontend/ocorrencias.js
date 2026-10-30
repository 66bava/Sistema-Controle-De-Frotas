import { montarCorrecoes } from './correcoes.js';
import { configurarDocumentos } from './documentos.js';
import { criarHistorico } from './historico.js';
import { iniciarNavegacao, selecionarNavegacao } from './navegacao.js';
import { montarFinalizacao } from './finalizacao.js';
import { api, feedback } from './api.js';
const q = (selector) => document.querySelector(selector);
let usuario,
  historico,
  viagemAtual = null,
  enviando = false,
  limparFinalizacao = () => {},
  limparCorrecoes = () => {};
const dataLocal = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
});
const kmFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
function data(valor) {
  return valor ? dataLocal.format(new Date(valor)) : 'A registrar';
}
function km(valor) {
  return valor === null || valor === undefined ? 'A registrar' : kmFormat.format(valor) + ' km';
}
function erro(error) {
  if (error.status === 401) window.location.replace('/');
  else feedback(error.message);
}
function view(nome) {
  for (const key of ['lista', 'nova', 'detalhe']) q('#' + key + '-view').hidden = key !== nome;
}
function horarioAgora() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return parts.year + '-' + parts.month + '-' + parts.day + 'T' + parts.hour + ':' + parts.minute;
}
function linkAtual() {
  const atual = usuario.perfil === 'driver' ? viagemAtual : null;
  q('#nova-viagem').hidden = usuario.perfil !== 'driver';
  q('#nova-viagem').href = atual ? historico.urlDetalhe(atual.id) : historico.urlNova();
  q('#nova-viagem').textContent = atual ? 'Abrir viagem em andamento ↗' : 'Nova viagem';
  return atual;
}
async function listar() {
  return historico.carregar();
}
function campo(label, valor) {
  const wrap = document.createElement('div');
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.textContent = valor;
  wrap.append(dt, dd);
  q('#detalhe-dados').append(wrap);
}
async function detalhe(id) {
  const { ocorrencia: item } = await api('/ocorrencias/' + encodeURIComponent(id));
  view('detalhe');
  selecionarNavegacao('viagens');
  window.history.replaceState(null, '', historico.urlDetalhe(item.id));
  q('#voltar-registros').href = historico.urlLista();
  q('#page-title').textContent = 'Detalhes da viagem';
  q('#page-subtitle').textContent = 'Confira os dados registrados na ocorrência.';
  configurarDocumentos(item);
  q('#detalhe-title').textContent = item.codigo;
  q('#detalhe-status').textContent = item.status === 'in_progress' ? 'Em andamento' : 'Concluída';
  q('#detalhe-status').dataset.active = String(item.status === 'in_progress');
  q('#detalhe-dados').replaceChildren();
  for (const [label, value] of [
    ['Veículo', item.marca + ' ' + item.modelo],
    ['Placa', item.placa],
    ['Condutor', item.condutor],
    ['Setor', item.setor],
    ['Saída', data(item.saida_em)],
    ['Chegada', data(item.chegada_em)],
    ['Km inicial', km(item.km_inicial)],
    ['Km final', km(item.km_final)],
    ['Distância', km(item.distancia_km)],
    ['Itinerário', item.itinerario],
  ])
    campo(label, value);
  q('#detalhe-passageiros').replaceChildren();
  for (const nome of item.passageiros) {
    const li = document.createElement('li');
    li.textContent = nome;
    q('#detalhe-passageiros').append(li);
  }
  q('#sem-passageiros').hidden = Boolean(item.passageiros.length);
  limparCorrecoes();
  limparCorrecoes = await montarCorrecoes(item, usuario, async () => {
    await listar();
    await detalhe(item.id);
  });
  limparFinalizacao();
  limparFinalizacao = montarFinalizacao(item, usuario, async (id, mensagem) => {
    await listar();
    await detalhe(id);
    feedback(mensagem, 'success');
  });
  if (
    usuario.perfil === 'driver' &&
    item.status === 'in_progress' &&
    item.condutor_id === usuario.id
  )
    q('#nova-viagem').hidden = true;
}
async function nova() {
  if (usuario.perfil !== 'driver') {
    feedback('Somente condutores podem iniciar suas próprias viagens.');
    view('lista');
    return;
  }
  const atual = linkAtual();
  if (atual) {
    await detalhe(atual.id);
    feedback('Conclua a viagem atual, incluindo a assinatura, antes de iniciar outra.');
    return;
  }
  view('nova');
  q('#nova-viagem').hidden = true;
  q('#page-title').textContent = 'Vamos iniciar o trajeto.';
  q('#page-subtitle').textContent =
    'Preencha a saída. Os dados de chegada serão registrados ao retornar.';
  const { veiculos, setores } = await api('/ocorrencias/opcoes');
  q('#viagem-condutor').value = usuario.nome;
  q('#viagem-saida').value = horarioAgora();
  for (const item of veiculos) {
    const option = document.createElement('option');
    option.value = item.id;
    option.disabled = item.em_viagem;
    option.textContent = item.modelo + ' · ' + item.placa + (item.em_viagem ? ' — Em viagem' : '');
    q('#viagem-veiculo').append(option);
  }
  for (const item of setores) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.nome;
    q('#viagem-setor').append(option);
  }
  if (!veiculos.some((v) => !v.em_viagem) || !setores.length) {
    feedback(
      'Não há veículo disponível ou setor ativo. Procure o administrador ou aguarde a conclusão das viagens em andamento.'
    );
    return;
  }
  q('#campos-viagem').disabled = false;
}
q('#nova-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (enviando) return;
  enviando = true;
  feedback('');
  q('#campos-viagem').disabled = true;
  q('#iniciar-viagem').textContent = 'Iniciando…';
  const body = {
    veiculo_id: Number(q('#viagem-veiculo').value),
    setor_id: Number(q('#viagem-setor').value),
    saida_em: q('#viagem-saida').value,
    km_inicial: Number(q('#viagem-km').value),
    itinerario: q('#viagem-itinerario').value,
    passageiros: q('#viagem-passageiros')
      .value.split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean),
  };
  try {
    const result = await api('/ocorrencias', { method: 'POST', body });
    window.history.replaceState(null, '', '/ocorrencias.html?id=' + result.ocorrencia.id);
    feedback(result.mensagem, 'success');
    await listar();
    await detalhe(result.ocorrencia.id);
  } catch (error) {
    erro(error);
  } finally {
    enviando = false;
    q('#campos-viagem').disabled = false;
    q('#iniciar-viagem').textContent = 'Registrar saída';
  }
});
q('#atualizar-viagens').addEventListener('click', async (event) => {
  event.currentTarget.disabled = true;
  try {
    feedback('');
    await historico.carregar({ atualizarOpcoes: true });
  } catch (error) {
    erro(error);
  } finally {
    q('#atualizar-viagens').disabled = false;
  }
});
q('#sair').addEventListener('click', async (event) => {
  event.currentTarget.disabled = true;
  try {
    await api('/auth/logout', { method: 'POST' });
    window.location.replace('/');
  } catch (error) {
    erro(error);
    q('#sair').disabled = false;
  }
});
try {
  ({ usuario } = await api('/auth/sessao'));
  iniciarNavegacao(
    usuario,
    new URLSearchParams(window.location.search).has('nova') ? 'nova' : 'viagens'
  );
  historico = criarHistorico(usuario, (result) => {
    viagemAtual = result.em_andamento;
    linkAtual();
  });
  q('#page-title').textContent =
    usuario.perfil === 'driver' ? 'Minhas viagens' : 'Viagens da frota';
  q('#page-subtitle').textContent =
    usuario.perfil === 'driver'
      ? 'Registre a saída e acompanhe seus trajetos.'
      : 'Acompanhe as ocorrências registradas pelos condutores.';
  await listar();
  const params = new URLSearchParams(window.location.search);
  if (params.has('id')) await detalhe(params.get('id'));
  else if (params.has('nova')) await nova();
  else view('lista');
} catch (error) {
  erro(error);
}
