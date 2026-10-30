import test from 'node:test';
import assert from 'node:assert/strict';
import { validarFiltrosHistorico } from '../utils/filtrosHistorico.js';
const admin = { id: 1, perfil: 'admin' };
test('período local inclui o dia final inteiro com limite superior exclusivo em UTC', () => {
  const result = validarFiltrosHistorico(
    { data_inicial: '2026-10-29', data_final: '2026-10-29' },
    admin
  );
  assert.equal(result.inicio.toISOString(), '2026-10-29T03:00:00.000Z');
  assert.equal(result.fim.toISOString(), '2026-10-30T03:00:00.000Z');
});
test('valida datas, período invertido, status, paginação e parâmetros repetidos', () => {
  for (const query of [
    { data_inicial: '2026-02-30' },
    { data_inicial: '2026-10-30', data_final: '2026-10-29' },
    { status: 'qualquer' },
    { pagina: '0' },
    { limite: '101' },
    { veiculo_id: '1 OR 1=1' },
    { busca: ['a', 'b'] },
  ])
    assert.throws(() => validarFiltrosHistorico(query, admin), { status: 422 });
});
test('condutor não pode filtrar viagens de outro usuário', () => {
  assert.throws(() => validarFiltrosHistorico({ condutor_id: '2' }, { id: 1, perfil: 'driver' }), {
    status: 403,
  });
  assert.equal(
    validarFiltrosHistorico({ condutor_id: '1' }, { id: 1, perfil: 'driver' }).condutor_id,
    1
  );
});
