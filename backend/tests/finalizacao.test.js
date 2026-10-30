import test from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { validarChegada, validarAssinatura } from '../utils/validacaoFinalizacao.js';
function imagem(desenhar = true, transparente = false) {
  const png = new PNG({ width: 240, height: 100 });
  png.data.fill(transparente ? 0 : 255);
  if (desenhar)
    for (let x = 20; x < 180; x++) {
      const y = 30 + Math.round(18 * Math.sin(x / 15));
      for (let dy = 0; dy < 3; dy++) {
        const i = ((y + dy) * png.width + x) * 4;
        png.data[i] = png.data[i + 1] = png.data[i + 2] = 20;
        png.data[i + 3] = 255;
      }
    }
  return 'data:image/png;base64,' + PNG.sync.write(png).toString('base64');
}
test('chegada no dia seguinte converte data completa para UTC', () => {
  const result = validarChegada({ chegada_em: '2026-10-30T01:00', km_final: 123.5 });
  assert.equal(result.chegada_em.toISOString(), '2026-10-30T04:00:00.000Z');
});
test('chegada rejeita distância manual, km inválido e data inexistente', () => {
  for (const dados of [
    { chegada_em: '2026-10-30T01:00', km_final: -1 },
    { chegada_em: '2026-02-30T01:00', km_final: 120 },
    { chegada_em: '2026-10-30T01:00', km_final: 120, distancia_km: 20 },
  ])
    assert.throws(() => validarChegada(dados), { status: 422 });
});
test('assinatura válida é decodificada e regravada como PNG', () => {
  const result = validarAssinatura({ assinatura: imagem(), revisao: 2 });
  assert.equal(result.revisao, 2);
  assert.equal(PNG.sync.read(result.imagem).width, 240);
});
test('assinatura vazia, transparente, inválida ou sem revisão é rejeitada', () => {
  for (const assinatura of [
    '',
    'data:image/png;base64,aW52YWxpZG8=',
    imagem(false),
    imagem(false, true),
  ])
    assert.throws(() => validarAssinatura({ assinatura, revisao: 2 }), { status: 422 });
  assert.throws(() => validarAssinatura({ assinatura: imagem() }), { status: 422 });
  assert.throws(
    () => validarAssinatura({ assinatura: imagem(), revisao: 2, status: 'completed' }),
    { status: 422 }
  );
});
