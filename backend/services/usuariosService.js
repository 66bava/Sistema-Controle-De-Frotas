import { obterConexao } from '../database/conexao.js';
import { ErroHttp } from '../utils/erroHttp.js';
export async function listar(filtros) {
  const clauses = [],
    params = [];
  for (const key of ['perfil', 'status'])
    if (filtros[key]) {
      clauses.push(key + '=?');
      params.push(filtros[key]);
    }
  if (filtros.busca) {
    clauses.push(
      "(nome LIKE ? ESCAPE '=' OR email LIKE ? ESCAPE '=' OR matricula LIKE ? ESCAPE '=' OR funcao LIKE ? ESCAPE '=')"
    );
    const pattern = '%' + filtros.busca.replace(/[=%_]/g, (c) => '=' + c) + '%';
    params.push(pattern, pattern, pattern, pattern);
  }
  const where = clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
  const conn = await obterConexao().getConnection();
  try {
    await conn.beginTransaction();
    const [[count]] = await conn.execute('SELECT COUNT(*) AS total FROM usuarios' + where, params);
    const total = Number(count.total),
      paginas = Math.ceil(total / 20),
      pagina = Math.min(filtros.pagina, Math.max(1, paginas));
    const [usuarios] = await conn.execute(
      'SELECT id,nome,email,matricula,funcao,perfil,status,atualizado_em FROM usuarios' +
        where +
        ' ORDER BY nome,id LIMIT 20 OFFSET ' +
        (pagina - 1) * 20,
      params
    );
    await conn.commit();
    return { usuarios, total, pagina, paginas };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
export async function alterar(id, administradorId, dados) {
  const conn = await obterConexao().getConnection();
  try {
    await conn.beginTransaction();
    // Serializa a gestão de acessos; protege o último administrador mesmo sob concorrência.
    const [users] = await conn.query(
      'SELECT id,perfil,status FROM usuarios ORDER BY id FOR UPDATE'
    );
    const ator = users.find((u) => u.id === administradorId),
      alvo = users.find((u) => u.id === id);
    if (ator?.perfil !== 'admin' || ator.status !== 'active')
      throw new ErroHttp(403, 'Seu acesso administrativo não está ativo.');
    if (!alvo) throw new ErroHttp(404, 'Usuário não encontrado.');
    if (alvo.status === 'pending')
      throw new ErroHttp(409, 'Aprove o cadastro antes de alterar seu acesso.');
    if (alvo.perfil === dados.perfil && alvo.status === dados.status) {
      await conn.commit();
      return;
    }
    if (
      alvo.perfil === 'admin' &&
      alvo.status === 'active' &&
      (dados.perfil !== 'admin' || dados.status !== 'active') &&
      users.filter((u) => u.perfil === 'admin' && u.status === 'active').length <= 1
    )
      throw new ErroHttp(409, 'Mantenha pelo menos um administrador ativo.');
    if (id === administradorId)
      throw new ErroHttp(409, 'Peça a outro administrador para alterar seu acesso.');
    if (dados.status !== 'active' || dados.perfil !== alvo.perfil) {
      const [viagens] = await conn.execute(
        "SELECT id FROM ocorrencias WHERE condutor_id=? AND status='in_progress' LIMIT 1",
        [id]
      );
      if (viagens.length)
        throw new ErroHttp(
          409,
          'Este condutor precisa concluir a viagem em andamento antes da alteração de acesso.'
        );
      const [correcoes] = await conn.execute(
        "SELECT id FROM correcoes_ocorrencia WHERE condutor_id=? AND status='pending' LIMIT 1",
        [id]
      );
      if (correcoes.length)
        throw new ErroHttp(
          409,
          'Este condutor precisa revisar a correção pendente antes da alteração de acesso.'
        );
    }
    await conn.execute('UPDATE usuarios SET perfil=?,status=? WHERE id=?', [
      dados.perfil,
      dados.status,
      id,
    ]);
    await conn.execute(
      "INSERT INTO auditoria(usuario_id,acao,entidade,entidade_id,detalhes) VALUES (?,'alterar_acesso','usuarios',?,?)",
      [
        administradorId,
        id,
        JSON.stringify({ antes: { perfil: alvo.perfil, status: alvo.status }, depois: dados }),
      ]
    );
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code))
      throw new ErroHttp(409, 'Outro acesso foi alterado. Atualize a lista e tente novamente.');
    throw error;
  } finally {
    conn.release();
  }
}
