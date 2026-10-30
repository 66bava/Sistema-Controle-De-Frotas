import { readFileSync } from 'node:fs';
// A paleta vem da mesma fonte de tokens usada no site.
const css = readFileSync(new URL('../../frontend/variables.css', import.meta.url), 'utf8');
function cor(nome) {
  const valor = css.match(new RegExp('--' + nome + ':\\s*(#[a-fA-F0-9]{6})'))?.[1];
  if (!valor) throw new Error('Token de cor do documento não encontrado: ' + nome);
  return valor;
}
export const temaDocumento = {
  grafite: cor('bg'),
  verde: cor('green'),
  verdeEscuro: cor('green-dark'),
  textoClaro: cor('text'),
  textoSecundario: cor('border'),
  branco: '#ffffff',
};
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
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
export function modeloDocumento(item, emitidoEm = new Date()) {
  const concluida = item.status === 'completed';
  return {
    codigo: item.codigo,
    revisao: item.revisao,
    concluida,
    status: concluida ? 'Concluída' : 'Em andamento · documento parcial',
    identificacao: [
      ['Veículo', item.marca + ' ' + item.modelo],
      ['Placa', item.placa],
      ['Condutor', item.condutor],
      ['Setor', item.setor],
    ],
    horarios: [
      ['Data da saída', date.format(new Date(item.saida_em))],
      ['Hora da saída', time.format(new Date(item.saida_em))],
      ['Data da chegada', item.chegada_em ? date.format(new Date(item.chegada_em)) : 'Pendente'],
      ['Hora da chegada', item.chegada_em ? time.format(new Date(item.chegada_em)) : 'Pendente'],
    ],
    quilometragem: [
      ['Km inicial', numero.format(item.km_inicial) + ' km'],
      ['Km final', item.km_final !== null ? numero.format(item.km_final) + ' km' : 'Pendente'],
      [
        'Distância',
        item.distancia_km !== null ? numero.format(item.distancia_km) + ' km' : 'A calcular',
      ],
    ],
    itinerario: item.itinerario,
    passageiros: item.passageiros,
    assinatura: concluida ? item.assinatura_condutor : null,
    assinaturaInfo: concluida
      ? 'Assinada por ' + item.condutor + ' em ' + datetime.format(new Date(item.assinado_em))
      : 'Assinatura do condutor pendente. A viagem ainda não foi concluída.',
    emissao: datetime.format(emitidoEm),
    fuso: 'Horário de Brasília',
    nota: 'Registro interno de protótipo. Mantenha a assinatura física durante a avaliação.',
  };
}
export function escaparHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
  );
}
