import { montarCondicoesHistorico } from '../utils/filtrosHistorico.js';
import { obterConexao } from '../database/conexao.js';
import { ErroHttp } from '../utils/erroHttp.js';
import { codigoOcorrencia } from '../utils/validacaoOcorrencia.js';
const resumo =
  'o.id, o.veiculo_id, o.condutor_id, o.setor_id, o.saida_em, o.chegada_em, o.km_inicial, o.km_final, o.distancia_km, o.itinerario, o.status, o.revisao, o.assinado_por, o.assinado_em, v.marca, v.modelo, v.placa, u.nome AS condutor, s.nome AS setor';
const joins =
  ' FROM ocorrencias o JOIN veiculos v ON v.id=o.veiculo_id JOIN usuarios u ON u.id=o.condutor_id JOIN setores s ON s.id=o.setor_id';
function publico(row) {
  return { ...row, codigo: codigoOcorrencia(row.id) };
}
export async function opcoes() {
  const pool = obterConexao();
  const [veiculos] = await pool.query(
    "SELECT v.id, v.marca, v.modelo, v.placa, EXISTS(SELECT 1 FROM ocorrencias o WHERE o.veiculo_id=v.id AND o.status='in_progress') AS em_viagem FROM veiculos v WHERE v.ativo=1 AND v.excluido_em IS NULL ORDER BY v.modelo, v.placa"
  );
  const [setores] = await pool.query('SELECT id, nome FROM setores WHERE ativo=1 ORDER BY nome');
  return { veiculos: veiculos.map((v) => ({ ...v, em_viagem: Boolean(v.em_viagem) })), setores };
}
export async function listar(usuario, filtros) {
  const { sql, params } = montarCondicoesHistorico(usuario, filtros);
  const conn = await obterConexao().getConnection();
  try {
    await conn.beginTransaction();
    const [counts] = await conn.execute('SELECT COUNT(*) AS total' + joins + sql, params);
    const total = Number(counts[0].total),
      paginas = Math.ceil(total / filtros.limite);
    const pagina = Math.min(filtros.pagina, Math.max(1, paginas));
    const offset = (pagina - 1) * filtros.limite;
    const [rows] = await conn.execute(
      'SELECT ' +
        resumo +
        joins +
        sql +
        " ORDER BY (o.status='in_progress') DESC, o.saida_em DESC, o.id DESC LIMIT " +
        filtros.limite +
        ' OFFSET ' +
        offset,
      params
    );
    // Independente dos filtros: nunca ocultar o bloqueio da viagem atual do condutor.
    let atual = null;
    if (usuario.perfil === 'driver') {
      const [abertas] = await conn.execute(
        "SELECT id FROM ocorrencias WHERE condutor_id=? AND status='in_progress' LIMIT 1",
        [usuario.id]
      );
      if (abertas[0]) atual = { id: abertas[0].id, codigo: codigoOcorrencia(abertas[0].id) };
    }
    await conn.commit();
    return {
      ocorrencias: rows.map(publico),
      total,
      pagina,
      paginas,
      limite: filtros.limite,
      em_andamento: atual,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
export async function filtrosDisponiveis(usuario) {
  const pool = obterConexao(),
    driver = usuario.perfil === 'driver';
  const where = driver ? ' WHERE o.condutor_id=?' : '';
  const params = driver ? [usuario.id] : [];
  const [veiculos] = await pool.execute(
    'SELECT DISTINCT v.id, v.modelo, v.placa, v.ativo, v.excluido_em FROM veiculos v JOIN ocorrencias o ON o.veiculo_id=v.id' +
      where +
      ' ORDER BY v.modelo, v.placa',
    params
  );
  const [setores] = await pool.execute(
    'SELECT DISTINCT s.id, s.nome, s.ativo FROM setores s JOIN ocorrencias o ON o.setor_id=s.id' +
      where +
      ' ORDER BY s.nome',
    params
  );
  const [condutores] = await pool.execute(
    'SELECT DISTINCT u.id, u.nome, u.status FROM usuarios u JOIN ocorrencias o ON o.condutor_id=u.id' +
      where +
      ' ORDER BY u.nome',
    params
  );
  return { veiculos, setores, condutores };
}
async function lerOcorrencia(id, usuario, incluirAssinatura = false) {
  const driver = usuario.perfil === 'driver';
  const conn = await obterConexao().getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      'SELECT ' +
        resumo +
        (incluirAssinatura ? ', o.assinatura_condutor' : '') +
        joins +
        ' WHERE o.id=?' +
        (driver ? ' AND o.condutor_id=?' : ''),
      driver ? [id, usuario.id] : [id]
    );
    if (!rows[0])
      throw new ErroHttp(404, 'Ocorrência não encontrada ou indisponível para seu acesso.');
    const [passageiros] = await conn.execute(
      'SELECT nome FROM passageiros WHERE ocorrencia_id=? ORDER BY id',
      [id]
    );
    await conn.commit();
    return { ...publico(rows[0]), passageiros: passageiros.map((p) => p.nome) };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
export async function buscar(id, usuario) {
  return lerOcorrencia(id, usuario);
}
export async function buscarParaDocumento(id, usuario) {
  return lerOcorrencia(id, usuario, true);
}
export async function iniciar(dados, usuarioId) {
  const conn = await obterConexao().getConnection();
  try {
    await conn.beginTransaction();
    const [drivers] = await conn.execute(
      'SELECT id, perfil, status FROM usuarios WHERE id=? FOR UPDATE',
      [usuarioId]
    );
    if (!drivers[0] || drivers[0].perfil !== 'driver' || drivers[0].status !== 'active')
      throw new ErroHttp(403, 'Seu acesso não permite iniciar viagens.');
    const [veiculos] = await conn.execute(
      'SELECT id, ativo, excluido_em FROM veiculos WHERE id=? FOR UPDATE',
      [dados.veiculo_id]
    );
    if (!veiculos[0] || !veiculos[0].ativo || veiculos[0].excluido_em)
      throw new ErroHttp(422, 'O veículo não está disponível. Atualize a lista e selecione outro.');
    const [setores] = await conn.execute('SELECT id, ativo FROM setores WHERE id=? FOR SHARE', [
      dados.setor_id,
    ]);
    if (!setores[0]?.ativo)
      throw new ErroHttp(422, 'O setor não está disponível. Atualize a lista e selecione outro.');
    const [own] = await conn.execute(
      "SELECT id FROM ocorrencias WHERE condutor_id=? AND status='in_progress' LIMIT 1",
      [usuarioId]
    );
    if (own.length)
      throw new ErroHttp(
        409,
        'Você já tem uma viagem em andamento. Abra a ocorrência atual e conclua a viagem, incluindo a assinatura, antes de iniciar outra.'
      );
    const [busy] = await conn.execute(
      "SELECT id FROM ocorrencias WHERE veiculo_id=? AND status='in_progress' LIMIT 1",
      [dados.veiculo_id]
    );
    if (busy.length)
      throw new ErroHttp(
        409,
        'Este veículo está em viagem. É necessário concluir a ocorrência em andamento antes de iniciar outra.'
      );
    const [result] = await conn.execute(
      'INSERT INTO ocorrencias (veiculo_id, condutor_id, setor_id, criado_por, saida_em, km_inicial, itinerario) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        dados.veiculo_id,
        usuarioId,
        dados.setor_id,
        usuarioId,
        dados.saida_em,
        dados.km_inicial.toFixed(1),
        dados.itinerario,
      ]
    );
    for (const nome of dados.passageiros)
      await conn.execute('INSERT INTO passageiros (ocorrencia_id, nome) VALUES (?, ?)', [
        result.insertId,
        nome,
      ]);
    await conn.execute(
      "INSERT INTO auditoria (usuario_id, ocorrencia_id, acao, entidade, entidade_id, detalhes) VALUES (?, ?, 'iniciar_viagem', 'ocorrencias', ?, ?)",
      [
        usuarioId,
        result.insertId,
        result.insertId,
        JSON.stringify({
          codigo: codigoOcorrencia(result.insertId),
          veiculo_id: dados.veiculo_id,
          setor_id: dados.setor_id,
        }),
      ]
    );
    await conn.commit();
    return result.insertId;
  } catch (error) {
    await conn.rollback();
    if (error.code === 'ER_DUP_ENTRY')
      throw new ErroHttp(
        409,
        'Já existe uma viagem em andamento para este veículo ou condutor. Conclua a anterior antes de iniciar outra.'
      );
    if (error.code === 'ER_LOCK_DEADLOCK' || error.code === 'ER_LOCK_WAIT_TIMEOUT')
      throw new ErroHttp(
        409,
        'Os dados foram atualizados durante o envio. Atualize a lista antes de tentar novamente.'
      );
    throw error;
  } finally {
    conn.release();
  }
}

export async function dadosParaExcel(usuario, filtros) {
  const { sql, params } = montarCondicoesHistorico(usuario, filtros);
  const conn = await obterConexao().getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      'SELECT ' +
        resumo +
        joins +
        sql +
        " ORDER BY (o.status='in_progress') DESC, o.saida_em DESC, o.id DESC",
      params
    );
    const [passageiros] = await conn.execute(
      'SELECT p.ocorrencia_id,p.nome' +
        joins +
        ' JOIN passageiros p ON p.ocorrencia_id=o.id' +
        sql +
        ' ORDER BY o.id,p.id',
      params
    );
    const nomes = new Map();
    for (const p of passageiros) {
      if (!nomes.has(p.ocorrencia_id)) nomes.set(p.ocorrencia_id, []);
      nomes.get(p.ocorrencia_id).push(p.nome);
    }
    const criterios = [];
    if (filtros.busca) criterios.push('Pesquisa: ' + filtros.busca);
    if (filtros.data_inicial)
      criterios.push('Saída a partir de ' + filtros.data_inicial.split('-').reverse().join('/'));
    if (filtros.data_final)
      criterios.push('Saída até ' + filtros.data_final.split('-').reverse().join('/'));
    if (filtros.status)
      criterios.push('Status: ' + (filtros.status === 'completed' ? 'Concluída' : 'Em andamento'));
    for (const [key, table, columns, label] of [
      ['veiculo_id', 'veiculos', "CONCAT(modelo, ' · ', placa)", 'Veículo'],
      ['condutor_id', 'usuarios', 'nome', 'Condutor'],
      ['setor_id', 'setores', 'nome', 'Setor'],
    ]) {
      if (!filtros[key]) continue;
      const [values] = await conn.execute(
        'SELECT ' + columns + ' AS nome FROM ' + table + ' WHERE id=?',
        [filtros[key]]
      );
      criterios.push(label + ': ' + (values[0]?.nome || 'Cadastro não encontrado'));
    }
    await conn.commit();
    return {
      registros: rows.map((row) => ({ ...publico(row), passageiros: nomes.get(row.id) || [] })),
      criterios: criterios.length ? criterios.join(' | ') : 'Todas as ocorrências, sem filtros.',
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
