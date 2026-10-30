import { Temporal } from '@js-temporal/polyfill';
import { obterConexao } from '../database/conexao.js';
import { codigoOcorrencia } from '../utils/validacaoOcorrencia.js';
export async function consultar(usuario) {
  const agora = Temporal.Now.instant(),
    hoje = agora.toZonedDateTimeISO('America/Sao_Paulo').toPlainDate();
  const inicio = new Date(hoje.toZonedDateTime('America/Sao_Paulo').epochMilliseconds);
  const fim = new Date(
    hoje.add({ days: 1 }).toZonedDateTime('America/Sao_Paulo').epochMilliseconds
  );
  const where = usuario.perfil === 'driver' ? ' WHERE o.condutor_id=?' : '';
  const params = usuario.perfil === 'driver' ? [usuario.id] : [];
  const conn = await obterConexao().getConnection();
  try {
    await conn.beginTransaction();
    const [[totais]] = await conn.execute(
      "SELECT COUNT(CASE WHEN o.saida_em>=? AND o.saida_em<? THEN 1 END) AS hoje, COUNT(CASE WHEN o.status='in_progress' THEN 1 END) AS em_andamento, COUNT(CASE WHEN o.status='completed' THEN 1 END) AS concluidas FROM ocorrencias o" +
        where,
      [inicio, fim, ...params]
    );
    const [[frota]] = await conn.query(
      'SELECT COUNT(*) AS ativos FROM veiculos WHERE ativo=1 AND excluido_em IS NULL'
    );
    const [recentes] = await conn.execute(
      'SELECT o.id,o.saida_em,o.status,v.modelo,v.placa,u.nome AS condutor FROM ocorrencias o JOIN veiculos v ON v.id=o.veiculo_id JOIN usuarios u ON u.id=o.condutor_id' +
        where +
        ' ORDER BY o.saida_em DESC,o.id DESC LIMIT 5',
      params
    );
    await conn.commit();
    return {
      data: hoje.toString(),
      atualizado_em: agora.toString(),
      indicadores: {
        hoje: Number(totais.hoje),
        em_andamento: Number(totais.em_andamento),
        concluidas: Number(totais.concluidas),
        veiculos_ativos: Number(frota.ativos),
      },
      recentes: recentes.map((item) => ({ ...item, codigo: codigoOcorrencia(item.id) })),
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
