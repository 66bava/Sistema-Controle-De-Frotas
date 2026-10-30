import { createHash } from 'node:crypto';
import { obterConexao } from '../database/conexao.js';
import { ErroHttp } from '../utils/erroHttp.js';
const json = (value) => (typeof value === 'string' ? JSON.parse(value) : value);
const campos = [
  'veiculo_id',
  'setor_id',
  'saida_em',
  'chegada_em',
  'km_inicial',
  'km_final',
  'itinerario',
  'passageiros',
];
const editaveis = (s) => Object.fromEntries(campos.map((k) => [k, s[k]]));
function canonical(v) {
  return Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical(v[k])])
        )
      : v;
}
function hash(c) {
  return createHash('sha256')
    .update(
      JSON.stringify(
        canonical([
          c.ocorrencia_id,
          c.revisao_base,
          c.administrador_id,
          c.condutor_id,
          c.justificativa,
          json(c.dados_anteriores),
          json(c.dados_propostos),
        ])
      )
    )
    .digest('hex');
}
function publico(c) {
  const antes = { ...json(c.dados_anteriores) };
  delete antes.assinatura_condutor;
  const { assinatura_administrador, assinatura_condutor, ...rest } = c;
  return { ...rest, dados_anteriores: antes, dados_propostos: json(c.dados_propostos) };
}
async function transacao(operacao) {
  const conn = await obterConexao().getConnection();
  try {
    await conn.beginTransaction();
    const [users] = await conn.query(
      'SELECT id,perfil,status FROM usuarios ORDER BY id FOR UPDATE'
    );
    const result = await operacao(conn, users);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    if (['ER_DUP_ENTRY', 'ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code))
      throw new ErroHttp(
        409,
        'A ocorrência foi atualizada ou já possui uma correção pendente. Reabra os dados.'
      );
    throw error;
  } finally {
    conn.release();
  }
}
function ativo(users, id) {
  const u = users.find((u) => u.id === id);
  if (u?.status !== 'active') throw new ErroHttp(403, 'O acesso do assinante não está ativo.');
  return u;
}
async function ocorrencia(conn, id) {
  const [[item]] = await conn.execute(
    'SELECT o.*,v.marca,v.modelo,v.placa,s.nome AS setor,u.nome AS condutor FROM ocorrencias o JOIN veiculos v ON v.id=o.veiculo_id JOIN setores s ON s.id=o.setor_id JOIN usuarios u ON u.id=o.condutor_id WHERE o.id=? FOR UPDATE',
    [id]
  );
  if (!item) throw new ErroHttp(404, 'Ocorrência não encontrada.');
  return item;
}
async function auditar(conn, ator, ocorrenciaId, correcaoId, acao, detalhes) {
  await conn.execute(
    'INSERT INTO auditoria(usuario_id,ocorrencia_id,correcao_id,acao,entidade,entidade_id,detalhes) VALUES (?,?,?,?,?,?,?)',
    [
      ator,
      ocorrenciaId,
      correcaoId,
      acao,
      'correcoes_ocorrencia',
      correcaoId,
      JSON.stringify(detalhes),
    ]
  );
}
export async function propor(id, administradorId, proposta) {
  return transacao(async (conn, users) => {
    if (ativo(users, administradorId).perfil !== 'admin')
      throw new ErroHttp(403, 'Somente administradores podem propor correções.');
    const item = await ocorrencia(conn, id);
    ativo(users, item.condutor_id);
    if (item.condutor_id === administradorId)
      throw new ErroHttp(
        409,
        'A correção precisa de outro administrador e do condutor responsável.'
      );
    if (item.status !== 'completed')
      throw new ErroHttp(409, 'Conclua e assine a viagem antes de solicitar uma correção.');
    if (item.revisao !== proposta.revisao)
      throw new ErroHttp(409, 'A revisão da ocorrência mudou. Reabra os dados antes de assinar.');
    const [pendentes] = await conn.execute(
      "SELECT id FROM correcoes_ocorrencia WHERE ocorrencia_id=? AND status='pending'",
      [id]
    );
    if (pendentes.length)
      throw new ErroHttp(409, 'Já existe uma correção aguardando a assinatura do condutor.');
    const [pax] = await conn.execute(
      'SELECT nome FROM passageiros WHERE ocorrencia_id=? ORDER BY id',
      [id]
    );
    const anteriores = JSON.parse(
      JSON.stringify({
        ...item,
        km_inicial: Number(item.km_inicial),
        km_final: Number(item.km_final),
        passageiros: pax.map((p) => p.nome),
        assinatura_condutor: item.assinatura_condutor.toString('base64'),
      })
    );
    const dados = JSON.parse(JSON.stringify(proposta.dados));
    if (JSON.stringify(editaveis(anteriores)) === JSON.stringify(editaveis(dados)))
      throw new ErroHttp(422, 'Altere pelo menos um dado da ocorrência.');
    const [[veiculo]] = await conn.execute(
      'SELECT marca,modelo,placa,ativo,excluido_em FROM veiculos WHERE id=? FOR SHARE',
      [dados.veiculo_id]
    );
    const [[setor]] = await conn.execute('SELECT nome,ativo FROM setores WHERE id=? FOR SHARE', [
      dados.setor_id,
    ]);
    if (
      !veiculo ||
      (dados.veiculo_id !== item.veiculo_id && (!veiculo.ativo || veiculo.excluido_em))
    )
      throw new ErroHttp(422, 'Selecione um veículo ativo.');
    if (!setor || (dados.setor_id !== item.setor_id && !setor.ativo))
      throw new ErroHttp(422, 'Selecione um setor ativo.');
    Object.assign(dados, {
      marca: veiculo.marca,
      modelo: veiculo.modelo,
      placa: veiculo.placa,
      setor: setor.nome,
      condutor: item.condutor,
    });
    const c = {
      ocorrencia_id: id,
      revisao_base: item.revisao,
      administrador_id: administradorId,
      condutor_id: item.condutor_id,
      justificativa: proposta.justificativa,
      dados_anteriores: anteriores,
      dados_propostos: dados,
    };
    const digest = hash(c);
    const [result] = await conn.execute(
      'INSERT INTO correcoes_ocorrencia(ocorrencia_id,revisao_base,administrador_id,condutor_id,justificativa,dados_anteriores,dados_propostos,conteudo_sha256,assinatura_administrador,administrador_assinou_em) VALUES (?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(3))',
      [
        id,
        item.revisao,
        administradorId,
        item.condutor_id,
        proposta.justificativa,
        JSON.stringify(anteriores),
        JSON.stringify(dados),
        digest,
        proposta.imagem,
      ]
    );
    await auditar(conn, administradorId, id, result.insertId, 'propor_correcao', {
      conteudo_sha256: digest,
      revisao_base: item.revisao,
    });
    return result.insertId;
  });
}
export async function confirmar(id, correcaoId, usuarioId, assinatura) {
  return transacao(async (conn, users) => {
    ativo(users, usuarioId);
    const item = await ocorrencia(conn, id);
    if (item.condutor_id !== usuarioId)
      throw new ErroHttp(404, 'Correção não encontrada ou indisponível para seu acesso.');
    const [[c]] = await conn.execute(
      'SELECT * FROM correcoes_ocorrencia WHERE id=? AND ocorrencia_id=? FOR UPDATE',
      [correcaoId, id]
    );
    if (!c) throw new ErroHttp(404, 'Correção não encontrada.');
    if (c.status !== 'pending') throw new ErroHttp(409, 'Esta correção já foi aplicada.');
    if (c.condutor_id !== usuarioId || c.administrador_id === usuarioId)
      throw new ErroHttp(403, 'Somente o condutor responsável pode confirmar esta correção.');
    if (
      c.revisao_base !== assinatura.revisao ||
      item.revisao !== c.revisao_base ||
      item.status !== 'completed' ||
      c.conteudo_sha256 !== assinatura.conteudo_sha256 ||
      hash(c) !== c.conteudo_sha256 ||
      !c.assinatura_administrador
    )
      throw new ErroHttp(409, 'A proposta ou a revisão mudou. Reabra a correção antes de assinar.');
    const d = json(c.dados_propostos);
    await conn.execute(
      'UPDATE ocorrencias SET veiculo_id=?,setor_id=?,saida_em=?,chegada_em=?,km_inicial=?,km_final=?,itinerario=?,assinatura_condutor=?,assinado_por=?,assinado_em=UTC_TIMESTAMP(3),revisao=revisao+1 WHERE id=?',
      [
        d.veiculo_id,
        d.setor_id,
        new Date(d.saida_em),
        new Date(d.chegada_em),
        d.km_inicial,
        d.km_final,
        d.itinerario,
        assinatura.imagem,
        usuarioId,
        id,
      ]
    );
    await conn.execute('DELETE FROM passageiros WHERE ocorrencia_id=?', [id]);
    for (const nome of d.passageiros)
      await conn.execute('INSERT INTO passageiros(ocorrencia_id,nome) VALUES (?,?)', [id, nome]);
    await conn.execute(
      "UPDATE correcoes_ocorrencia SET assinatura_condutor=?,condutor_assinou_em=UTC_TIMESTAMP(3),status='applied',aplicado_em=UTC_TIMESTAMP(3) WHERE id=?",
      [assinatura.imagem, correcaoId]
    );
    await auditar(conn, usuarioId, id, correcaoId, 'aplicar_correcao', {
      conteudo_sha256: c.conteudo_sha256,
      revisao_anterior: item.revisao,
      revisao_atual: item.revisao + 1,
    });
  });
}
export async function listarPendentes(usuario) {
  const [rows] = await obterConexao().execute(
    "SELECT c.id,c.ocorrencia_id,c.justificativa,c.criado_em,u.nome AS condutor,a.nome AS administrador FROM correcoes_ocorrencia c JOIN usuarios u ON u.id=c.condutor_id JOIN usuarios a ON a.id=c.administrador_id WHERE c.status='pending'" +
      (usuario.perfil === 'driver' ? ' AND c.condutor_id=?' : '') +
      ' ORDER BY c.criado_em,c.id LIMIT 200',
    usuario.perfil === 'driver' ? [usuario.id] : []
  );
  return rows;
}
export async function historico(id, usuario) {
  const [[item]] = await obterConexao().execute(
    'SELECT condutor_id FROM ocorrencias WHERE id=?' +
      (usuario.perfil === 'driver' ? ' AND condutor_id=?' : ''),
    usuario.perfil === 'driver' ? [id, usuario.id] : [id]
  );
  if (!item) throw new ErroHttp(404, 'Ocorrência não encontrada ou indisponível para seu acesso.');
  const [rows] = await obterConexao().execute(
    'SELECT c.id,c.ocorrencia_id,c.revisao_base,c.administrador_id,c.condutor_id,c.justificativa,c.dados_anteriores,c.dados_propostos,c.conteudo_sha256,c.administrador_assinou_em,c.condutor_assinou_em,c.status,c.aplicado_em,c.criado_em,u.nome AS administrador FROM correcoes_ocorrencia c JOIN usuarios u ON u.id=c.administrador_id WHERE c.ocorrencia_id=? ORDER BY c.id DESC',
    [id]
  );
  return rows.map(publico);
}
export async function imagem(id, correcaoId, parte, usuario) {
  if (!['administrador', 'condutor', 'anterior'].includes(parte))
    throw new ErroHttp(404, 'Assinatura não encontrada.');
  const campo = {
    administrador: 'c.assinatura_administrador',
    condutor: 'c.assinatura_condutor',
    anterior: "JSON_UNQUOTE(JSON_EXTRACT(c.dados_anteriores,'$.assinatura_condutor'))",
  }[parte];
  const [[row]] = await obterConexao().execute(
    'SELECT ' +
      campo +
      ' AS imagem FROM correcoes_ocorrencia c JOIN ocorrencias o ON o.id=c.ocorrencia_id WHERE c.id=? AND c.ocorrencia_id=?' +
      (usuario.perfil === 'driver' ? ' AND o.condutor_id=?' : ''),
    usuario.perfil === 'driver' ? [correcaoId, id, usuario.id] : [correcaoId, id]
  );
  if (!row?.imagem)
    throw new ErroHttp(404, 'Assinatura não encontrada ou indisponível para seu acesso.');
  return parte === 'anterior' ? Buffer.from(row.imagem, 'base64') : row.imagem;
}
