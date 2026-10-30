import { api } from './api.js';
import { criarAssinatura } from './assinaturaCanvas.js';
const q = (selector) => document.querySelector(selector);
const numeros = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
function horario(valor) {
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
      .formatToParts(new Date(valor))
      .map((p) => [p.type, p.value])
  );
  return parts.year + '-' + parts.month + '-' + parts.day + 'T' + parts.hour + ':' + parts.minute;
}
export function montarFinalizacao(item, usuario, aoAtualizar) {
  const events = new AbortController();
  const own = usuario.perfil === 'driver' && usuario.id === item.condutor_id;
  q('#finalizacao-section').hidden = !(own && item.status === 'in_progress');
  q('#assinatura-salva').hidden = item.status !== 'completed';
  const image = q('#assinatura-imagem');
  image.removeAttribute('src');
  if (item.status === 'completed') {
    image.src = '/api/ocorrencias/' + item.id + '/assinatura?revisao=' + item.revisao;
    q('#assinatura-info').textContent =
      'Assinada por ' +
      item.condutor +
      ' em ' +
      new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(item.assinado_em));
  }
  if (!own || item.status !== 'in_progress') return () => events.abort();
  let busy = false,
    dirty = false,
    temAssinatura = false,
    pad,
    destruido = false;
  const chegou = item.chegada_em !== null && item.km_final !== null;
  const chegada = q('#chegada-data'),
    km = q('#chegada-km'),
    confirmar = q('#confirmar-assinatura');
  chegada.value = horario(
    item.chegada_em || new Date(Math.max(Date.now(), new Date(item.saida_em).getTime()))
  );
  chegada.min = horario(item.saida_em);
  km.value = item.km_final ?? '';
  q('#salvar-chegada').textContent = chegou
    ? 'Salvar alterações da chegada'
    : 'Registrar chegada e continuar';
  q('#assinatura-etapa').hidden = !chegou;
  q('#assinatura-mensagem').textContent =
    'Desenhe sua assinatura para confirmar os dados desta ocorrência.';
  q('#finalizacao-erro').hidden = true;
  q('#finalizacao-erro').textContent = '';
  function estado() {
    if (destruido) return;
    confirmar.disabled = busy || dirty || !temAssinatura;
    q('#salvar-chegada').disabled = busy;
    q('#limpar-assinatura').disabled = busy || dirty;
    chegada.disabled = busy;
    km.disabled = busy;
    pad?.habilitar(!busy && !dirty);
  }
  function mensagem(error) {
    if (error.status === 401) {
      window.location.replace('/');
      return;
    }
    q('#finalizacao-erro').textContent = error.message;
    q('#finalizacao-erro').hidden = false;
  }
  function distancia() {
    chegada.setCustomValidity(
      chegada.value && chegada.value < horario(item.saida_em)
        ? 'A chegada não pode ser anterior à saída. Confira também a data.'
        : ''
    );
    const valor = Number(km.value);
    const valido = km.value !== '' && Number.isFinite(valor) && valor >= Number(item.km_inicial);
    q('#distancia-prevista').textContent = valido
      ? numeros.format(Math.round((valor - Number(item.km_inicial)) * 10) / 10) + ' km'
      : '—';
    km.setCustomValidity(
      km.value !== '' && valor < Number(item.km_inicial)
        ? 'O km final não pode ser menor que o km inicial.'
        : ''
    );
  }
  if (chegou)
    pad = criarAssinatura(q('#assinatura-canvas'), (value) => {
      temAssinatura = value;
      q('#assinatura-placeholder').hidden = value;
      estado();
    });
  function mudou() {
    distancia();
    if (chegou) {
      dirty = true;
      pad?.limpar();
      q('#assinatura-mensagem').textContent =
        'Os dados foram alterados. Salve a chegada novamente antes de assinar.';
      estado();
    }
  }
  chegada.addEventListener('input', mudou, { signal: events.signal });
  km.addEventListener('input', mudou, { signal: events.signal });
  q('#chegada-form').addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();
      if (busy) return;
      busy = true;
      estado();
      q('#finalizacao-erro').hidden = true;
      try {
        await api('/ocorrencias/' + item.id + '/chegada', {
          method: 'PUT',
          body: { chegada_em: chegada.value, km_final: Number(km.value) },
        });
        await aoAtualizar(item.id, 'Chegada salva. Assine para concluir a viagem.');
      } catch (error) {
        mensagem(error);
      } finally {
        busy = false;
        estado();
      }
    },
    { signal: events.signal }
  );
  q('#limpar-assinatura').addEventListener(
    'click',
    () => {
      if (!busy) pad?.limpar();
    },
    { signal: events.signal }
  );
  confirmar.addEventListener(
    'click',
    async () => {
      if (busy || dirty || !pad) return;
      try {
        const assinatura = pad.exportar();
        busy = true;
        estado();
        q('#finalizacao-erro').hidden = true;
        confirmar.textContent = 'Concluindo…';
        await api('/ocorrencias/' + item.id + '/assinatura', {
          method: 'POST',
          body: { assinatura, revisao: item.revisao },
        });
        await aoAtualizar(
          item.id,
          'Viagem concluída com sucesso. Veículo e condutor estão liberados.'
        );
      } catch (error) {
        mensagem(error);
      } finally {
        busy = false;
        confirmar.textContent = 'Assinar e concluir viagem';
        estado();
      }
    },
    { signal: events.signal }
  );
  distancia();
  estado();
  return () => {
    destruido = true;
    events.abort();
    pad?.destruir();
  };
}
