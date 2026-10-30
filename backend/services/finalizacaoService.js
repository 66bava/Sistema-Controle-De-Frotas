import { createHash } from 'node:crypto';
import { obterConexao } from '../database/conexao.js';
import { ErroHttp } from '../utils/erroHttp.js';
async function alterar(id, usuarioId, operacao) {
  const conn = await obterConexao().getConnection();
  try {
    await conn.beginTransaction();
    const [users] = await conn.execute(
      'SELECT perfil, status FROM usuarios WHERE id=? FOR UPDATE',
      [usuarioId]
    );
    if (users[0]?.perfil !== 'driver' || users[0]?.status !== 'active')
      throw new ErroHttp(403, 'Seu acesso não permite finalizar viagens.');
    const [rows] = await conn.execute(
      'SELECT id, condutor_id, status, saida_em, chegada_em, km_inicial, km_final, revisao FROM ocorrencias WHERE id=? AND condutor_id=? FOR UPDATE',
      [id, usuarioId]
    );
    const row = rows[0];
    if (!row) throw new ErroHttp(404, 'Ocorrência não encontrada ou indisponível para seu acesso.');
    if (row.status !== 'in_progress')
      throw new ErroHttp(
        409,
        'Esta viagem já está concluída. Reabra a ocorrência para conferir os dados.'
      );
    await operacao(conn, row);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    if (error.code === 'ER_LOCK_DEADLOCK' || error.code === 'ER_LOCK_WAIT_TIMEOUT')
      throw new ErroHttp(
        409,
        'A viagem foi atualizada durante o envio. Reabra a ocorrência antes de tentar novamente.'
      );
    throw error;
  } finally {
    conn.release();
  }
}
export async function salvarChegada(id, usuarioId, dados) {
  await alterar(id, usuarioId, async (conn, row) => {
    if (dados.chegada_em < row.saida_em)
      throw new ErroHttp(422, 'A chegada não pode ser anterior à saída. Confira também a data.');
    if (dados.km_final < Number(row.km_inicial))
      throw new ErroHttp(422, 'O km final não pode ser menor que o km inicial.');
    if (
      row.chegada_em?.getTime() === dados.chegada_em.getTime() &&
      Number(row.km_final) === dados.km_final
    )
      return;
    await conn.execute(
      'UPDATE ocorrencias SET chegada_em=?, km_final=?, revisao=revisao+1 WHERE id=?',
      [dados.chegada_em, dados.km_final.toFixed(1), id]
    );
    await conn.execute(
      "INSERT INTO auditoria (usuario_id, ocorrencia_id, acao, entidade, entidade_id, detalhes) VALUES (?, ?, 'registrar_chegada', 'ocorrencias', ?, ?)",
      [
        usuarioId,
        id,
        id,
        JSON.stringify({
          antes: { chegada_em: row.chegada_em, km_final: row.km_final },
          depois: { chegada_em: dados.chegada_em, km_final: dados.km_final },
          revisao: row.revisao + 1,
        }),
      ]
    );
  });
}
export async function assinarEConcluir(id, usuarioId, dados) {
  await alterar(id, usuarioId, async (conn, row) => {
    if (!row.chegada_em || row.km_final === null)
      throw new ErroHttp(422, 'Registre a chegada e o km final antes de assinar.');
    if (row.revisao !== dados.revisao)
      throw new ErroHttp(
        409,
        'Os dados da viagem mudaram. Reabra a ocorrência, confira a chegada e assine novamente.'
      );
    await conn.execute(
      "UPDATE ocorrencias SET assinatura_condutor=?, assinado_por=?, assinado_em=UTC_TIMESTAMP(3), status='completed', revisao=revisao+1 WHERE id=?",
      [dados.imagem, usuarioId, id]
    );
    const detalhes = JSON.stringify({
      revisao_assinada: row.revisao,
      revisao_concluida: row.revisao + 1,
      assinatura_sha256: createHash('sha256').update(dados.imagem).digest('hex'),
    });
    for (const acao of ['assinar_ocorrencia', 'concluir_viagem'])
      await conn.execute(
        'INSERT INTO auditoria (usuario_id, ocorrencia_id, acao, entidade, entidade_id, detalhes) VALUES (?, ?, ?, ?, ?, ?)',
        [usuarioId, id, acao, 'ocorrencias', id, detalhes]
      );
  });
}
export async function obterAssinatura(id, usuario) {
  const driver = usuario.perfil === 'driver';
  const [rows] = await obterConexao().execute(
    "SELECT assinatura_condutor FROM ocorrencias WHERE id=? AND status='completed'" +
      (driver ? ' AND condutor_id=?' : ''),
    driver ? [id, usuario.id] : [id]
  );
  if (!rows[0]?.assinatura_condutor)
    throw new ErroHttp(404, 'Assinatura não encontrada ou indisponível para seu acesso.');
  return rows[0].assinatura_condutor;
}
