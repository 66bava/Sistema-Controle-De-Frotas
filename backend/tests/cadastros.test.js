import test from 'node:test';
import assert from 'node:assert/strict';
import { validarCadastroFrota, validarId } from '../utils/validacaoCadastros.js';
test('veículo normaliza placas antigas e Mercosul', () => {
  const base = { marca: ' Fiat ', modelo: ' Argo ', placa: 'abc-1234' };
  const old = validarCadastroFrota('veiculos', base);
  assert.equal(old.placa, 'ABC1234');
  assert.equal(old.marca, 'Fiat');
  assert.equal(old.ativo, true);
  assert.equal(old.numero_interno, null);
  assert.equal(validarCadastroFrota('veiculos', { ...base, placa: 'abc1d23' }).placa, 'ABC1D23');
});
test('cadastros rejeitam placa inválida, vazio, status ambíguo e tamanho excedido', () => {
  for (const data of [
    { marca: 'Fiat', modelo: 'Argo', placa: 'XXXXXXX' },
    { marca: '', modelo: 'Argo', placa: 'ABC1234' },
    { marca: 'Fiat', modelo: 'Argo', placa: 'ABC1234', ativo: 'false' },
  ])
    assert.throws(() => validarCadastroFrota('veiculos', data), { status: 422 });
  assert.throws(() => validarCadastroFrota('setores', { nome: ' ' }), { status: 422 });
  assert.throws(() => validarCadastroFrota('setores', { nome: 'a'.repeat(101) }), { status: 422 });
});
test('identificador inválido nunca chega à consulta SQL', () => {
  assert.equal(validarId('42'), 42);
  for (const id of ['0', '-1', '1 OR 1=1', '1.2', '4294967296'])
    assert.throws(() => validarId(id), { status: 422 });
});
