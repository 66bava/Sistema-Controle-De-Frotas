import { obterConexao } from '../database/conexao.js';
import { conferirSenha, gerarHash } from './senhaService.js';
import { ErroHttp } from '../utils/erroHttp.js';
const campos = 'id, nome, email, matricula, funcao, perfil, status';
export function usuarioPublico(user) {
  return Object.fromEntries(
    ['id', 'nome', 'email', 'matricula', 'funcao', 'perfil', 'status'].map((key) => [
      key,
      user[key],
    ])
  );
}
export async function cadastrar(dados) {
  const hash = await gerarHash(dados.senha);
  try {
    const [result] = await obterConexao().execute(
      "INSERT INTO usuarios (nome, email, senha_hash, matricula, funcao, perfil, status) VALUES (?, ?, ?, ?, ?, 'driver', 'pending')",
      [dados.nome, dados.email, hash, dados.matricula, dados.funcao]
    );
    return result.insertId;
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY')
      throw new ErroHttp(
        409,
        'Não foi possível cadastrar. Confira se e-mail ou matrícula já estão em uso.'
      );
    throw error;
  }
}
export async function entrar(email, senha) {
  const [rows] = await obterConexao().execute(
    'SELECT ' + campos + ', senha_hash FROM usuarios WHERE email = ?',
    [email]
  );
  const user = rows[0];
  // Mantém o trabalho de derivação mesmo para um e-mail inexistente.
  if (!user) {
    await gerarHash(senha);
    throw new ErroHttp(401, 'E-mail ou senha incorretos.');
  }
  if (!(await conferirSenha(senha, user.senha_hash)))
    throw new ErroHttp(401, 'E-mail ou senha incorretos.');
  if (user.status === 'pending')
    throw new ErroHttp(403, 'Seu cadastro aguarda aprovação do administrador.');
  if (user.status !== 'active')
    throw new ErroHttp(403, 'Seu acesso está inativo. Procure o administrador.');
  return usuarioPublico(user);
}
export async function buscarUsuario(id) {
  const [rows] = await obterConexao().execute('SELECT ' + campos + ' FROM usuarios WHERE id = ?', [
    id,
  ]);
  return rows[0];
}
export async function listarPendentes() {
  const [rows] = await obterConexao().query(
    'SELECT ' +
      campos +
      ", criado_em FROM usuarios WHERE status = 'pending' ORDER BY criado_em, id LIMIT 200"
  );
  return rows;
}
export async function aprovar(id, administradorId) {
  const conn = await obterConexao().getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      'SELECT id, status, perfil FROM usuarios WHERE id = ? FOR UPDATE',
      [id]
    );
    if (!rows[0]) throw new ErroHttp(404, 'Usuário não encontrado.');
    if (rows[0].status !== 'pending' || rows[0].perfil !== 'driver')
      throw new ErroHttp(409, 'Este cadastro não está pendente de aprovação.');
    await conn.execute(
      "UPDATE usuarios SET status = 'active', aprovado_por = ?, aprovado_em = UTC_TIMESTAMP(3) WHERE id = ?",
      [administradorId, id]
    );
    await conn.execute(
      "INSERT INTO auditoria (usuario_id, acao, entidade, entidade_id, detalhes) VALUES (?, 'aprovar_cadastro', 'usuarios', ?, JSON_OBJECT('status_anterior', 'pending', 'status_atual', 'active'))",
      [administradorId, id]
    );
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
