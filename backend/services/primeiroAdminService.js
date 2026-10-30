import { obterConexao } from '../database/conexao.js';
import { gerarHash } from './senhaService.js';
import { validarCadastro } from '../utils/validacao.js';
import { ErroHttp } from '../utils/erroHttp.js';
// Uso exclusivamente local pelo comando criar-admin. Não expor em rota HTTP.
export async function criarPrimeiroAdmin(entrada) {
  const dados = validarCadastro(entrada);
  const hash = await gerarHash(dados.senha);
  const conn = await obterConexao().getConnection();
  let bloqueado = false;
  try {
    const [lock] = await conn.query(
      "SELECT GET_LOCK(CONCAT(DATABASE(), ':primeiro-admin'), 10) AS adquirido"
    );
    bloqueado = lock[0].adquirido === 1;
    if (!bloqueado) throw new ErroHttp(409, 'Outro cadastro de administrador está em andamento.');
    await conn.beginTransaction();
    const [admins] = await conn.query("SELECT id FROM usuarios WHERE perfil = 'admin' LIMIT 1");
    if (admins.length)
      throw new ErroHttp(409, 'Já existe administrador. Este comando cria apenas o primeiro.');
    const [result] = await conn.execute(
      "INSERT INTO usuarios (nome, email, senha_hash, perfil, status) VALUES (?, ?, ?, 'admin', 'active')",
      [dados.nome, dados.email, hash]
    );
    await conn.execute(
      "INSERT INTO auditoria (usuario_id, acao, entidade, entidade_id) VALUES (?, 'criar_primeiro_admin', 'usuarios', ?)",
      [result.insertId, result.insertId]
    );
    await conn.commit();
    return result.insertId;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    try {
      if (bloqueado) await conn.query("SELECT RELEASE_LOCK(CONCAT(DATABASE(), ':primeiro-admin'))");
    } finally {
      conn.release();
    }
  }
}
