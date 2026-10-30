import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { gerarExcel, colunasExcel, linhaExcel } from '../services/excelService.js';
const base = {
  codigo: 'OC-000127',
  marca: 'Chevrolet',
  modelo: 'Spin',
  placa: 'DEM1A01',
  condutor: 'Ana Silva',
  setor: 'Comercial',
  saida_em: new Date('2026-10-30T02:30:00Z'),
  chegada_em: new Date('2026-10-30T04:00:00Z'),
  km_inicial: 52381.5,
  km_final: 52406.5,
  distancia_km: 25,
  itinerario: 'Sede → cliente → sede',
  passageiros: ['Maria Silva', 'Pedro Santos'],
  status: 'completed',
};
async function abrir(buffer) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  return book.getWorksheet('Ocorrências');
}
function cell(sheet, key, row = 7) {
  return sheet.getCell(row, colunasExcel.findIndex((c) => c.key === key) + 1);
}
test('Excel mantém datas civis de Brasília, horários e quilômetros numéricos', async () => {
  const buffer = await gerarExcel([base], {
    criterios: 'Data de saída: 29/10/2026',
    emitidoEm: new Date('2026-10-30T12:00:00Z'),
  });
  const sheet = await abrir(buffer);
  assert.equal(buffer.subarray(0, 2).toString(), 'PK');
  assert.equal(cell(sheet, 'data_saida').value.toISOString(), '2026-10-29T00:00:00.000Z');
  assert.equal(cell(sheet, 'data_chegada').value.toISOString(), '2026-10-30T00:00:00.000Z');
  assert.ok(Math.abs(linhaExcel(base).saida - 23.5 / 24) < 1e-10);
  assert.equal(cell(sheet, 'saida').value.getUTCHours(), 23);
  assert.equal(cell(sheet, 'saida').value.getUTCMinutes(), 30);
  assert.equal(cell(sheet, 'saida').numFmt, 'hh:mm');
  assert.equal(cell(sheet, 'km_inicial').value, 52381.5);
  assert.equal(cell(sheet, 'distancia').value, 25);
  assert.equal(cell(sheet, 'passageiros').value, 'Maria Silva\nPedro Santos');
  assert.equal(sheet.getCell('A1').fill.fgColor.argb, 'FF101212');
  assert.equal(sheet.getCell('A3').fill.fgColor.argb, 'FFB1EF70');
  assert.equal(sheet.views[0].state, 'frozen');
  assert.equal(sheet.views[0].ySplit, 6);
  assert.ok(sheet.autoFilter);
  assert.ok(sheet.getCell('A4').value.includes('29/10/2026'));
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/modelo-exportacao.xlsx', buffer);
});
test('viagem em andamento mantém chegada e km final vazios sem inventar valores', async () => {
  const sheet = await abrir(
    await gerarExcel([
      {
        ...base,
        status: 'in_progress',
        chegada_em: null,
        km_final: null,
        distancia_km: null,
        passageiros: [],
      },
    ])
  );
  for (const key of ['data_chegada', 'chegada', 'km_final', 'distancia'])
    assert.equal(cell(sheet, key).value, null);
  assert.equal(cell(sheet, 'status').value, 'Em andamento');
});
test('texto semelhante a fórmula permanece literal e conteúdo longo não é truncado', async () => {
  const passageiros = Array.from(
    { length: 50 },
    (_, n) => 'Passageiro ' + n + ' ' + 'a'.repeat(130)
  );
  const item = {
    ...base,
    condutor: '=1+1',
    setor: '@SUM(A1)',
    itinerario: '=HYPERLINK("https://example.invalid","x")',
    passageiros,
  };
  const sheet = await abrir(await gerarExcel([item]));
  for (const key of ['condutor', 'setor', 'itinerario']) {
    assert.equal(cell(sheet, key).type, ExcelJS.ValueType.String);
    assert.equal(cell(sheet, key).formula, undefined);
    assert.equal(cell(sheet, key).value, item[key]);
  }
  assert.equal(cell(sheet, 'passageiros').value, passageiros.join('\n'));
});
test('resultado vazio ainda gera planilha válida com títulos e cabeçalhos', async () => {
  const sheet = await abrir(await gerarExcel([]));
  assert.equal(sheet.rowCount, 6);
  assert.equal(sheet.getRow(6).getCell(1).value, 'Código');
  assert.ok(sheet.getCell('A3').value.includes('0 ocorrência'));
});
