import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validarNovaOcorrencia,
  validarSaida,
  codigoOcorrencia,
} from '../utils/validacaoOcorrencia.js';
const base = {
  veiculo_id: 1,
  setor_id: 1,
  saida_em: '2026-10-29T23:30',
  km_inicial: 52381.5,
  itinerario: 'Sede → cliente → sede',
};
test('saída à noite preserva data local ao converter para UTC', () => {
  assert.equal(validarSaida(base.saida_em).toISOString(), '2026-10-30T02:30:00.000Z');
  assert.equal(codigoOcorrencia(1), 'OC-000001');
  assert.equal(codigoOcorrencia(1234567), 'OC-1234567');
});
test('datas inexistentes e horário local inexistente não são normalizados silenciosamente', () => {
  for (const value of ['2026-02-30T12:00', '2026-10-29', '2026-10-29T25:00', '2018-11-04T00:30'])
    assert.throws(() => validarSaida(value), { status: 422 });
});
test('passageiros são opcionais e nomes são normalizados', () => {
  assert.deepEqual(validarNovaOcorrencia(base).passageiros, []);
  assert.deepEqual(
    validarNovaOcorrencia({ ...base, passageiros: [' Maria ', 'João'] }).passageiros,
    ['Maria', 'João']
  );
});
test('início rejeita distância manual, troca de condutor, km inválido e dados incompletos', () => {
  for (const extra of [
    { distancia_km: 10 },
    { condutor_id: 2 },
    { status: 'completed' },
    { km_inicial: -1 },
    { km_inicial: 1.25 },
    { km_inicial: '' },
    { itinerario: ' ' },
    { veiculo_id: 0 },
    { passageiros: [' '] },
  ])
    assert.throws(() => validarNovaOcorrencia({ ...base, ...extra }), { status: 422 });
});
