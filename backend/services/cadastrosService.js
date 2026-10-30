import { obterConexao } from '../database/conexao.js';
import { ErroHttp } from '../utils/erroHttp.js';
// Tabelas e campos são constantes internas; nunca são obtidos de dados da requisição.
const entidades = {
  veiculos: {
    campos: ['marca', 'modelo', 'placa', 'numero_interno', 'ativo'],
    ordem: 'modelo, placa',
    singular: 'Veículo',
  },
  setores: { campos: ['nome', 'ativo'], ordem: 'nome', singular: 'Setor' },
};
function config(tipo) {
  if (!Object.hasOwn(entidades, tipo)) throw new Error('Entidade não suportada.');
  return entidades[tipo];
}
function filtro(tipo) {
  return tipo === 'veiculos' ? ' AND excluido_em IS NULL' : '';
}
function publico(row) {
  return { ...row, ativo: Boolean(row.ativo) };
}
function duplicado(error, tipo) {
  if (error.code === 'ER_DUP_ENTRY')
    throw new ErroHttp(
      409,
      tipo === 'veiculos'
        ? 'Placa ou número interno já cadastrado, inclusive em veículos arquivados.'
        : 'Já existe um setor com esse nome.'
    );
  throw error;
}
export async function listar(tipo) {
  const { campos, ordem } = config(tipo);
  const [rows] = await obterConexao().query(
    'SELECT id, ' +
      campos.join(', ') +
      ' FROM ' +
      tipo +
      ' WHERE 1=1' +
      filtro(tipo) +
      ' ORDER BY ' +
      ordem
  );
  return rows.map(publico);
}
export async function buscar(tipo, id) {
  const { campos, singular } = config(tipo);
  const [rows] = await obterConexao().execute(
    'SELECT id, ' + campos.join(', ') + ' FROM ' + tipo + ' WHERE id=?' + filtro(tipo),
    [id]
  );
  if (!rows[0]) throw new ErroHttp(404, singular + ' não encontrado.');
  return publico(rows[0]);
}
export async function salvar(tipo, id, dados, usuarioId) {
  const { campos, singular } = config(tipo);
  const conn = await obterConexao().getConnection();
  try {
    await conn.beginTransaction();
    let antes = null;
    if (id) {
      const [rows] = await conn.execute(
        'SELECT id, ' +
          campos.join(', ') +
          ' FROM ' +
          tipo +
          ' WHERE id=?' +
          filtro(tipo) +
          ' FOR UPDATE',
        [id]
      );
      if (!rows[0]) throw new ErroHttp(404, singular + ' não encontrado.');
      antes = publico(rows[0]);
      await conn.execute(
        'UPDATE ' + tipo + ' SET ' + campos.map((c) => c + '=?').join(', ') + ' WHERE id=?',
        [...campos.map((c) => dados[c]), id]
      );
    } else {
      const [result] = await conn.execute(
        'INSERT INTO ' +
          tipo +
          ' (' +
          campos.join(', ') +
          ') VALUES (' +
          campos.map(() => '?').join(', ') +
          ')',
        campos.map((c) => dados[c])
      );
      id = result.insertId;
    }
    await conn.execute(
      'INSERT INTO auditoria (usuario_id, acao, entidade, entidade_id, detalhes) VALUES (?, ?, ?, ?, ?)',
      [
        usuarioId,
        antes ? 'editar_cadastro' : 'criar_cadastro',
        tipo,
        id,
        JSON.stringify({ antes, depois: { id, ...dados } }),
      ]
    );
    await conn.commit();
    return { id, ...dados };
  } catch (error) {
    await conn.rollback();
    duplicado(error, tipo);
  } finally {
    conn.release();
  }
}
export async function arquivarVeiculo(id, usuarioId) {
  const conn = await obterConexao().getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      'SELECT id, marca, modelo, placa, numero_interno, ativo FROM veiculos WHERE id=? AND excluido_em IS NULL FOR UPDATE',
      [id]
    );
    if (!rows[0]) throw new ErroHttp(404, 'Veículo não encontrado.');
    await conn.execute('UPDATE veiculos SET ativo=0, excluido_em=UTC_TIMESTAMP(3) WHERE id=?', [
      id,
    ]);
    await conn.execute(
      "INSERT INTO auditoria (usuario_id, acao, entidade, entidade_id, detalhes) VALUES (?, 'arquivar_veiculo', 'veiculos', ?, ?)",
      [
        usuarioId,
        id,
        JSON.stringify({ antes: publico(rows[0]), depois: { ativo: false, arquivado: true } }),
      ]
    );
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
