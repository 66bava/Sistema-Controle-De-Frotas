import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { modeloDocumento, temaDocumento } from '../services/documentoModel.js';
import { gerarPdf } from '../services/pdfService.js';
import { gerarHtmlImpressao } from '../services/impressaoService.js';
const item = {
  codigo: 'OC-000127',
  revisao: 3,
  status: 'completed',
  marca: 'Chevrolet',
  modelo: 'Spin',
  placa: 'DEM1A01',
  condutor: 'Ana Silva',
  setor: 'Comercial',
  saida_em: new Date('2026-10-29T23:30:00-03:00'),
  chegada_em: new Date('2026-10-30T01:00:00-03:00'),
  km_inicial: 52381,
  km_final: 52417,
  distancia_km: 36,
  itinerario: 'Sede → Centro → Sede',
  passageiros: ['Maria Silva', 'Pedro Santos'],
  assinado_em: new Date('2026-10-30T01:05:00-03:00'),
};
function assinatura() {
  const p = new PNG({ width: 480, height: 140 });
  p.data.fill(255);
  for (let x = 40; x < 410; x++)
    for (let n = 0; n < 3; n++) {
      const y = 60 + Math.round(25 * Math.sin(x / 18));
      const i = ((y + n) * p.width + x) * 4;
      p.data[i] = p.data[i + 1] = p.data[i + 2] = 25;
    }
  return PNG.sync.write(p);
}
async function pdfjs() {
  const canvas = await import('@napi-rs/canvas');
  globalThis.DOMMatrix ??= canvas.DOMMatrix;
  globalThis.ImageData ??= canvas.ImageData;
  globalThis.Path2D ??= canvas.Path2D;
  return { ...(await import('pdfjs-dist/legacy/build/pdf.mjs')), canvas };
}
async function abrir(buffer) {
  const lib = await pdfjs();
  const task = lib.getDocument({ data: new Uint8Array(buffer), useSystemFonts: false });
  const documento = await task.promise;
  return { lib, documento, encerrar: () => task.destroy() };
}
async function texto(documento) {
  const result = [];
  for (let n = 1; n <= documento.numPages; n++) {
    const content = await (await documento.getPage(n)).getTextContent();
    result.push(content.items.map((i) => i.str).join(' '));
  }
  return result.join(' ');
}
async function renderizar(documento, lib, pagina, nome) {
  const page = await documento.getPage(pagina),
    viewport = page.getViewport({ scale: 1.5 });
  const canvas = lib.canvas.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  await writeFile(nome, canvas.toBuffer('image/png'));
}
test('PDF A4 inclui dados, assinatura e paleta do site com fonte incorporada', async () => {
  const model = modeloDocumento(
    { ...item, assinatura_condutor: assinatura() },
    new Date('2026-10-30T05:00:00Z')
  );
  assert.equal(temaDocumento.grafite, '#101212');
  assert.equal(temaDocumento.verde, '#b1ef70');
  const buffer = await gerarPdf(model);
  assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
  const { lib, documento, encerrar } = await abrir(buffer);
  try {
    assert.equal(documento.numPages, 1);
    const page = await documento.getPage(1),
      v = page.getViewport({ scale: 1 });
    assert.ok(Math.abs(v.width - 595.28) < 1);
    assert.ok(Math.abs(v.height - 841.89) < 1);
    const content = await texto(documento);
    for (const value of [
      'OC-000127',
      'OCORRÊNCIAS DIÁRIAS',
      'DE TRANSPORTE',
      'Ana Silva',
      'DEM1A01',
      '29/10/2026',
      '30/10/2026',
      '36 km',
      'Maria Silva',
      'Assinada por',
    ])
      assert.ok(content.includes(value), value);
    const ops = await page.getOperatorList();
    assert.ok(ops.fnArray.includes(lib.OPS.paintImageXObject));
    await mkdir('test-results', { recursive: true });
    await writeFile('test-results/ocorrencia-modelo.pdf', buffer);
    await renderizar(documento, lib, 1, 'test-results/pdf-modelo-preview.png');
  } finally {
    await encerrar();
  }
});
test('PDF parcial informa pendências sem inventar chegada ou assinatura', async () => {
  const model = modeloDocumento({
    ...item,
    status: 'in_progress',
    chegada_em: null,
    km_final: null,
    distancia_km: null,
    assinatura_condutor: null,
    assinado_em: null,
  });
  const { documento, encerrar } = await abrir(await gerarPdf(model));
  try {
    const content = await texto(documento);
    assert.ok(content.includes('documento parcial'));
    assert.ok(content.includes('Assinatura do condutor pendente'));
    assert.ok(content.includes('A calcular'));
  } finally {
    await encerrar();
  }
});
test('documento longo preserva todo o conteúdo em várias páginas A4 sem texto fora das margens', async () => {
  const longo = {
    ...item,
    itinerario:
      'INICIO-ITINERARIO ' +
      'Trecho de rota com informações detalhadas. '.repeat(44).slice(0, 1850) +
      ' FIM-ITINERARIO',
    passageiros: Array.from(
      { length: 50 },
      (_, n) =>
        'PASSAGEIRO-' +
        String(n + 1).padStart(2, '0') +
        ' ' +
        'Nome composto de demonstração '.repeat(4).slice(0, 120)
    ),
    assinatura_condutor: assinatura(),
  };
  const buffer = await gerarPdf(modeloDocumento(longo));
  const { lib, documento, encerrar } = await abrir(buffer);
  try {
    assert.ok(documento.numPages > 1);
    assert.ok(documento.numPages < 12);
    const content = await texto(documento);
    for (const value of ['INICIO-ITINERARIO', 'FIM-ITINERARIO', 'PASSAGEIRO-50', 'Assinada por'])
      assert.ok(content.includes(value), value);
    await mkdir('test-results', { recursive: true });
    await writeFile('test-results/ocorrencia-longa.pdf', buffer);
    const paginasTexto = [];
    for (let n = 1; n <= documento.numPages; n++) {
      const items = await (await documento.getPage(n)).getTextContent();
      paginasTexto.push(
        items.items
          .map((i) => i.str)
          .join(' ')
          .replace(/\s+/g, ' ')
      );
    }
    for (const nome of longo.passageiros)
      assert.ok(
        paginasTexto.some((text) => text.includes(nome.trim().replace(/\s+/g, ' '))),
        'Nome dividido entre páginas: ' + nome
      );
    for (const text of paginasTexto)
      assert.ok(
        text.includes('Controle de Frotas') && text.includes(modeloDocumento(longo).codigo),
        'Cabeçalho ausente'
      );
    for (let n = 1; n <= documento.numPages; n++) {
      const page = await documento.getPage(n),
        items = await page.getTextContent();
      for (const text of items.items) {
        if (!text.str.trim()) continue;
        assert.ok(
          text.transform[4] >= 38 && text.transform[4] + text.width <= page.view[2] - 35,
          'Texto fora da largura: ' + text.str
        );
        assert.ok(
          text.transform[5] >= 12 && text.transform[5] <= page.view[3] - 25,
          'Texto fora da altura: ' + text.str
        );
      }
      await renderizar(documento, lib, n, 'test-results/pdf-longo-' + n + '.png');
    }
  } finally {
    await encerrar();
  }
});
test('HTML de impressão escapa dados e mantém assinatura como imagem, sem scripts de usuário', () => {
  const model = modeloDocumento({
    ...item,
    itinerario: '<script>alert("x")</script>',
    passageiros: ['Ana & João <Teste>'],
    assinatura_condutor: assinatura(),
  });
  const html = gerarHtmlImpressao(model);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>alert'));
  assert.ok(html.includes('Ana &amp; João &lt;Teste&gt;'));
  assert.ok(html.includes('data:image/png;base64,'));
  assert.ok(html.includes('/documento.css'));
});
