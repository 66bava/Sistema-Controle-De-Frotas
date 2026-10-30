import { api, feedback } from './api.js';
import { criarAssinatura } from './assinaturaCanvas.js';
const q = (id) => document.getElementById(id);
const datetime = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
});
const labels = {
  veiculo: 'Veículo',
  setor: 'Setor',
  saida_em: 'Saída',
  chegada_em: 'Chegada',
  km_inicial: 'Km inicial',
  km_final: 'Km final',
  itinerario: 'Itinerário',
  passageiros: 'Passageiros',
};
function local(v) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(v))
      .map((x) => [x.type, x.value])
  );
  return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute;
}
function valor(d, k) {
  if (k === 'veiculo') return d.modelo + ' · ' + d.placa;
  if (k === 'passageiros') return d.passageiros.join(', ') || 'Nenhum';
  if (k.endsWith('_em')) return datetime.format(new Date(d[k]));
  if (k.startsWith('km_')) return new Intl.NumberFormat('pt-BR').format(d[k]) + ' km';
  return d[k];
}
function texto(tag, s) {
  const el = document.createElement(tag);
  el.textContent = s;
  return el;
}
export async function montarCorrecoes(item, usuario, aoAtualizar) {
  const events = new AbortController(),
    pads = [];
  let busy = false,
    destruido = false;
  const on = (id, name, fn) => q(id).addEventListener(name, fn, { signal: events.signal });
  const falha = (e) => {
    if (e.status === 401) window.location.replace('/');
    q('correcao-erro').textContent = e.message;
    q('correcao-erro').hidden = false;
  };
  q('correcao-form').hidden = true;
  q('correcao-confirmacao').hidden = true;
  q('abrir-correcao').hidden = true;
  q('correcao-erro').hidden = true;
  q('correcao-historico').replaceChildren();
  q('correcao-status').textContent = 'Carregando histórico de correções…';
  let correcoes;
  try {
    ({ correcoes } = await api('/ocorrencias/' + item.id + '/correcoes'));
  } catch (e) {
    q('correcao-status').textContent =
      'Não foi possível carregar as correções. Recarregue a página para tentar novamente.';
    falha(e);
    return () => events.abort();
  }
  const pendente = correcoes.find((c) => c.status === 'pending');
  q('correcao-status').textContent = pendente
    ? 'Existe uma proposta aguardando a assinatura do condutor. O registro atual permanece válido.'
    : correcoes.length
      ? 'Histórico de alterações com as versões anteriores preservadas.'
      : 'Nenhuma correção registrada.';
  function imagem(c, parte, label) {
    const wrap = document.createElement('div');
    wrap.className = 'correcao-assinatura';
    wrap.append(texto('p', label));
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = '/api/ocorrencias/' + item.id + '/correcoes/' + c.id + '/assinatura/' + parte;
    img.alt = label;
    wrap.append(img);
    return wrap;
  }
  for (const c of correcoes) {
    const details = document.createElement('details');
    details.className = 'correcao-registro';
    details.open = c.status === 'pending';
    details.append(
      texto(
        'summary',
        'Correção #' +
          c.id +
          ' · ' +
          (c.status === 'pending' ? 'Aguardando condutor' : 'Aplicada') +
          ' · revisão ' +
          c.revisao_base +
          ' → ' +
          (c.revisao_base + 1)
      )
    );
    details.append(
      texto(
        'p',
        'Administrador: ' +
          c.administrador +
          ' · ' +
          datetime.format(new Date(c.administrador_assinou_em))
      ),
      texto('p', 'Justificativa: ' + c.justificativa)
    );
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    const table = document.createElement('table'),
      thead = document.createElement('thead'),
      head = document.createElement('tr');
    for (const t of ['Campo', 'Anterior', 'Proposto']) {
      const th = texto('th', t);
      th.scope = 'col';
      head.append(th);
    }
    thead.append(head);
    const caption = texto(
      'caption',
      'Compare os dados anteriores e propostos. No celular, deslize a tabela para ver todas as colunas.'
    );
    table.append(caption, thead);
    const tbody = document.createElement('tbody');
    for (const k of Object.keys(labels)) {
      const tr = document.createElement('tr');
      const a = valor(c.dados_anteriores, k),
        b = valor(c.dados_propostos, k);
      tr.dataset.alterado = String(a !== b);
      tr.append(texto('td', labels[k]), texto('td', a), texto('td', b));
      tbody.append(tr);
    }
    table.append(tbody);
    wrap.append(table);
    details.append(wrap);
    details.append(imagem(c, 'administrador', 'Assinatura do administrador'));
    if (c.status === 'applied') {
      details.append(
        texto(
          'p',
          'Confirmada pelo condutor em ' + datetime.format(new Date(c.condutor_assinou_em))
        ),
        imagem(c, 'condutor', 'Assinatura do condutor na correção')
      );
    }
    const anterior = document.createElement('details');
    anterior.append(
      texto('summary', 'Consultar assinatura da versão anterior'),
      imagem(c, 'anterior', 'Assinatura original preservada')
    );
    details.append(anterior);
    q('correcao-historico').append(details);
  }
  if (pendente && usuario.id === item.condutor_id) {
    q('correcao-confirmacao').hidden = false;
    q('correcao-concordo').checked = false;
    let assinou = false;
    function estado() {
      q('correcao-confirmar').disabled = busy || !assinou || !q('correcao-concordo').checked;
      q('correcao-condutor-limpar').disabled = busy;
      q('correcao-concordo').disabled = busy;
      pad.habilitar(!busy);
    }
    let padPronto = false;
    const pad = criarAssinatura(q('correcao-condutor-canvas'), (v) => {
      assinou = v;
      if (padPronto) estado();
    });
    padPronto = true;
    pads.push(pad);
    estado();
    on('correcao-concordo', 'change', estado);
    on('correcao-condutor-limpar', 'click', () => pad.limpar());
    on('correcao-confirmar', 'click', async () => {
      if (busy || !assinou || !q('correcao-concordo').checked) return;
      try {
        const assinatura = pad.exportar();
        busy = true;
        estado();
        await api('/ocorrencias/' + item.id + '/correcoes/' + pendente.id + '/confirmar', {
          method: 'POST',
          body: {
            assinatura,
            revisao: pendente.revisao_base,
            conteudo_sha256: pendente.conteudo_sha256,
          },
        });
        await aoAtualizar();
        feedback(
          'Correção aplicada com as duas assinaturas. A versão anterior foi preservada.',
          'success'
        );
      } catch (e) {
        falha(e);
      } finally {
        busy = false;
        if (!destruido) estado();
      }
    });
  }
  if (
    usuario.perfil === 'admin' &&
    usuario.id !== item.condutor_id &&
    item.status === 'completed' &&
    !pendente
  ) {
    q('abrir-correcao').hidden = false;
    let pad = null,
      assinou = false;
    function estado() {
      q('correcao-enviar').disabled = busy || !assinou;
      q('correcao-campos').disabled = busy;
      for (const id of ['correcao-admin-limpar', 'correcao-cancelar']) q(id).disabled = busy;
      pad?.habilitar(!busy);
    }
    on('abrir-correcao', 'click', async () => {
      if (busy) return;
      busy = true;
      q('abrir-correcao').disabled = true;
      try {
        const [vs, ss] = await Promise.all([api('/veiculos'), api('/setores')]);
        for (const [id, items, atual, legenda] of [
          ['correcao-veiculo', vs.veiculos, item.veiculo_id, (v) => v.modelo + ' · ' + v.placa],
          ['correcao-setor', ss.setores, item.setor_id, (s) => s.nome],
        ]) {
          q(id).replaceChildren();
          for (const v of items.filter((v) => v.ativo || v.id === atual)) {
            const o = new Option(legenda(v) + (v.ativo ? '' : ' (inativo)'), v.id);
            q(id).add(o);
          }
          if (!Array.from(q(id).options).some((o) => Number(o.value) === atual))
            q(id).add(
              new Option(
                id === 'correcao-veiculo' ? item.modelo + ' · ' + item.placa : item.setor,
                atual
              )
            );
          q(id).value = atual;
        }
        q('correcao-saida').value = local(item.saida_em);
        q('correcao-chegada').value = local(item.chegada_em);
        q('correcao-km-inicial').value = item.km_inicial;
        q('correcao-km-final').value = item.km_final;
        q('correcao-itinerario').value = item.itinerario;
        q('correcao-passageiros').value = item.passageiros.join('\n');
        q('correcao-justificativa').value = '';
        q('correcao-form').hidden = false;
        q('abrir-correcao').hidden = true;
        pad = criarAssinatura(q('correcao-admin-canvas'), (v) => {
          assinou = v;
          estado();
        });
        pads.push(pad);
        q('correcao-veiculo').focus();
      } catch (e) {
        falha(e);
      } finally {
        busy = false;
        q('abrir-correcao').disabled = false;
        estado();
      }
    });
    on('correcao-campos', 'input', () => {
      pad?.limpar();
      q('correcao-chegada').setCustomValidity(
        q('correcao-chegada').value < q('correcao-saida').value
          ? 'A chegada não pode ser anterior à saída.'
          : ''
      );
      q('correcao-km-final').setCustomValidity(
        Number(q('correcao-km-final').value) < Number(q('correcao-km-inicial').value)
          ? 'O km final não pode ser menor que o km inicial.'
          : ''
      );
    });
    on('correcao-admin-limpar', 'click', () => pad?.limpar());
    on('correcao-cancelar', 'click', () => {
      if (busy) return;
      pad?.destruir();
      pad = null;
      assinou = false;
      q('correcao-form').hidden = true;
      q('abrir-correcao').hidden = false;
    });
    on('correcao-form', 'submit', async (e) => {
      e.preventDefault();
      if (busy || !pad || !assinou) return;
      try {
        const body = {
          veiculo_id: Number(q('correcao-veiculo').value),
          setor_id: Number(q('correcao-setor').value),
          saida_em: q('correcao-saida').value,
          chegada_em: q('correcao-chegada').value,
          km_inicial: Number(q('correcao-km-inicial').value),
          km_final: Number(q('correcao-km-final').value),
          itinerario: q('correcao-itinerario').value,
          passageiros: q('correcao-passageiros')
            .value.split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean),
          justificativa: q('correcao-justificativa').value,
          assinatura: pad.exportar(),
          revisao: item.revisao,
        };
        busy = true;
        estado();
        await api('/ocorrencias/' + item.id + '/correcoes', { method: 'POST', body });
        await aoAtualizar();
        feedback(
          'Proposta assinada. O condutor deve abrir Correções pendentes para conferir e assinar.',
          'success'
        );
      } catch (e) {
        falha(e);
      } finally {
        busy = false;
        if (!destruido) estado();
      }
    });
  }
  return () => {
    destruido = true;
    events.abort();
    for (const pad of pads) pad.destruir();
  };
}
