import { Temporal } from '@js-temporal/polyfill';
import { ErroHttp } from './erroHttp.js';
const permitidos = [
  'busca',
  'data_inicial',
  'data_final',
  'veiculo_id',
  'condutor_id',
  'setor_id',
  'status',
  'pagina',
  'limite',
];
function valor(query, key) {
  const raw = query[key];
  if (raw === undefined || raw === '') return null;
  if (typeof raw !== 'string') throw new ErroHttp(422, 'Confira o filtro ' + key + '.');
  return raw.trim() || null;
}
function inteiro(raw, nome, max) {
  if (!raw) return null;
  if (!/^[1-9]\d*$/.test(raw) || Number(raw) > max)
    throw new ErroHttp(422, 'Confira o filtro ' + nome + '.');
  return Number(raw);
}
function dia(raw) {
  if (!raw) return null;
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error();
    const d = Temporal.PlainDate.from(raw);
    if (d.year < 1000 || d.year > 9999) throw new Error();
    return d;
  } catch {
    throw new ErroHttp(422, 'Informe datas válidas para o período.');
  }
}
function inicioUtc(d) {
  return d.toZonedDateTime('America/Sao_Paulo').toInstant();
}
export function validarFiltrosHistorico(query, usuario) {
  if (Object.keys(query).some((key) => !permitidos.includes(key)))
    throw new ErroHttp(422, 'Filtro de histórico não reconhecido.');
  const busca = valor(query, 'busca');
  if (busca && busca.length > 150) throw new ErroHttp(422, 'Use até 150 caracteres na pesquisa.');
  const de = dia(valor(query, 'data_inicial')),
    ate = dia(valor(query, 'data_final'));
  if (de && ate && Temporal.PlainDate.compare(de, ate) > 0)
    throw new ErroHttp(422, 'A data final não pode ser anterior à inicial.');
  const condutor = inteiro(valor(query, 'condutor_id'), 'condutor', 4294967295);
  if (usuario.perfil === 'driver' && condutor && condutor !== usuario.id)
    throw new ErroHttp(403, 'Você pode consultar somente suas próprias viagens.');
  const status = valor(query, 'status');
  if (status && !['in_progress', 'completed'].includes(status))
    throw new ErroHttp(422, 'Selecione um status válido.');
  const fim = ate ? inicioUtc(ate.add({ days: 1 })) : null;
  return {
    busca,
    data_inicial: de?.toString() || null,
    data_final: ate?.toString() || null,
    inicio: de ? new Date(inicioUtc(de).epochMilliseconds) : null,
    fim: fim && fim.toZonedDateTimeISO('UTC').year <= 9999 ? new Date(fim.epochMilliseconds) : null,
    veiculo_id: inteiro(valor(query, 'veiculo_id'), 'veículo', 4294967295),
    setor_id: inteiro(valor(query, 'setor_id'), 'setor', 4294967295),
    condutor_id: condutor,
    status,
    pagina: inteiro(valor(query, 'pagina'), 'página', 2147483647) || 1,
    limite: inteiro(valor(query, 'limite'), 'itens por página', 100) || 20,
  };
}
export function montarCondicoesHistorico(usuario, filtros) {
  const clauses = [],
    params = [];
  function add(sql, value) {
    clauses.push(sql);
    params.push(value);
  }
  if (usuario.perfil === 'driver') add('o.condutor_id=?', usuario.id);
  if (filtros.inicio) add('o.saida_em>=?', filtros.inicio);
  if (filtros.fim) add('o.saida_em<?', filtros.fim);
  for (const key of ['veiculo_id', 'setor_id', 'condutor_id', 'status'])
    if (filtros[key]) add('o.' + key + '=?', filtros[key]);
  if (filtros.busca) {
    const pattern = '%' + filtros.busca.replace(/[=%_]/g, (char) => '=' + char) + '%';
    const campos = [
      "CONCAT('OC-', IF(o.id<1000000, LPAD(o.id,6,'0'), CAST(o.id AS CHAR)))",
      'v.placa',
      'v.marca',
      'v.modelo',
      'u.nome',
      's.nome',
      'o.itinerario',
    ];
    clauses.push(
      '(' +
        campos.map((c) => c + " LIKE ? ESCAPE '='").join(' OR ') +
        " OR EXISTS(SELECT 1 FROM passageiros p WHERE p.ocorrencia_id=o.id AND p.nome LIKE ? ESCAPE '='))"
    );
    params.push(...Array(campos.length + 1).fill(pattern));
  }
  return { sql: clauses.length ? ' WHERE ' + clauses.join(' AND ') : '', params };
}
