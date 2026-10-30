import ExcelJS from 'exceljs';
import { Temporal } from '@js-temporal/polyfill';
import { temaDocumento } from './documentoModel.js';
import { ErroHttp } from '../utils/erroHttp.js';
const color = (hex) => 'FF' + hex.slice(1).toUpperCase();
const cores = {
  grafite: color(temaDocumento.grafite),
  verde: color(temaDocumento.verde),
  texto: color(temaDocumento.verdeEscuro),
  branco: 'FFFFFFFF',
};
export const colunasExcel = [
  { key: 'codigo', header: 'Código', width: 18 },
  { key: 'data_saida', header: 'Data de saída', width: 16 },
  { key: 'veiculo', header: 'Veículo', width: 26 },
  { key: 'placa', header: 'Placa', width: 13 },
  { key: 'condutor', header: 'Condutor', width: 28 },
  { key: 'passageiros', header: 'Passageiros', width: 34 },
  { key: 'setor', header: 'Setor', width: 22 },
  { key: 'saida', header: 'Saída', width: 12 },
  { key: 'data_chegada', header: 'Data de chegada', width: 17 },
  { key: 'chegada', header: 'Chegada', width: 12 },
  { key: 'km_inicial', header: 'Km inicial', width: 15 },
  { key: 'km_final', header: 'Km final', width: 15 },
  { key: 'distancia', header: 'Distância (km)', width: 17 },
  { key: 'itinerario', header: 'Itinerário', width: 52 },
  { key: 'status', header: 'Status', width: 20 },
];
function local(valor) {
  return Temporal.Instant.from(new Date(valor).toISOString()).toZonedDateTimeISO(
    'America/Sao_Paulo'
  );
}
function dataExcel(z) {
  // Datas do Excel não possuem fuso: gravar componentes locais como data civil.
  if (z.year < 1900)
    return [String(z.day).padStart(2, '0'), String(z.month).padStart(2, '0'), z.year].join('/');
  return new Date(Date.UTC(z.year, z.month - 1, z.day));
}
function horaExcel(z) {
  return (z.hour * 3600 + z.minute * 60 + z.second + z.millisecond / 1000) / 86400;
}
export function linhaExcel(item) {
  const saida = local(item.saida_em),
    chegada = item.chegada_em ? local(item.chegada_em) : null;
  return {
    codigo: String(item.codigo),
    data_saida: dataExcel(saida),
    veiculo: String(item.marca + ' ' + item.modelo),
    placa: String(item.placa),
    condutor: String(item.condutor),
    passageiros: item.passageiros.map(String).join('\n'),
    setor: String(item.setor),
    saida: horaExcel(saida),
    data_chegada: chegada ? dataExcel(chegada) : null,
    chegada: chegada ? horaExcel(chegada) : null,
    km_inicial: Number(item.km_inicial),
    km_final: item.km_final === null ? null : Number(item.km_final),
    distancia: item.distancia_km === null ? null : Number(item.distancia_km),
    itinerario: String(item.itinerario),
    status: item.status === 'completed' ? 'Concluída' : 'Em andamento',
  };
}
export async function gerarExcel(
  registros,
  { criterios = 'Todas as ocorrências, sem filtros.', emitidoEm = new Date() } = {}
) {
  if (registros.length > 1048570)
    throw new ErroHttp(
      413,
      'O resultado excede o limite de linhas do Excel. Selecione um período menor.'
    );
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Controle de Frotas';
  workbook.created = emitidoEm;
  workbook.modified = emitidoEm;
  const sheet = workbook.addWorksheet('Ocorrências', {
    properties: { defaultRowHeight: 24 },
    views: [{ state: 'frozen', xSplit: 2, ySplit: 6, showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  sheet.columns = colunasExcel.map(({ key, width }) => ({ key, width }));
  sheet.mergeCells('A1:O2');
  sheet.getCell('A1').value = 'OCORRÊNCIAS DIÁRIAS DE TRANSPORTE';
  sheet.getCell('A1').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: cores.grafite },
  };
  sheet.getCell('A1').font = {
    name: 'Calibri',
    size: 18,
    bold: true,
    color: { argb: cores.branco },
  };
  sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(1).height = 24;
  sheet.getRow(2).height = 16;
  const emissao = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(emitidoEm);
  sheet.mergeCells('A3:O3');
  sheet.getCell('A3').value =
    'Controle de Frotas · ' +
    registros.length +
    ' ocorrência(s) · Emitido em ' +
    emissao +
    ' · Horário de Brasília';
  sheet.getCell('A3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cores.verde } };
  sheet.getCell('A3').font = {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: cores.texto },
  };
  sheet.getCell('A3').alignment = { vertical: 'middle', indent: 1 };
  sheet.getRow(3).height = 26;
  sheet.mergeCells('A4:O4');
  sheet.getCell('A4').value = 'Filtros aplicados: ' + criterios;
  sheet.getCell('A4').font = { name: 'Calibri', size: 11, color: { argb: cores.grafite } };
  sheet.getCell('A4').alignment = { vertical: 'middle', wrapText: true, indent: 1 };
  sheet.getRow(4).height = Math.max(30, Math.min(120, Math.ceil(criterios.length / 220) * 16));
  sheet.getRow(5).height = 10;
  const header = sheet.getRow(6);
  header.values = colunasExcel.map((col) => col.header);
  header.height = 30;
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cores.grafite } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: cores.verde } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  for (const item of registros) {
    const values = linhaExcel(item),
      row = sheet.addRow(values);
    row.height = Math.min(
      409,
      Math.max(
        30,
        Math.ceil(item.itinerario.length / 48) * 14,
        item.passageiros.reduce((n, nome) => n + Math.ceil(nome.length / 32), 0) * 14
      )
    );
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: 'Calibri', size: 11, color: { argb: cores.grafite } };
      cell.alignment = { vertical: 'top', wrapText: true };
    });
    for (const key of ['data_saida', 'data_chegada']) row.getCell(key).numFmt = 'dd/mm/yyyy';
    for (const key of ['saida', 'chegada']) row.getCell(key).numFmt = 'hh:mm';
    for (const key of ['km_inicial', 'km_final', 'distancia']) row.getCell(key).numFmt = '#,##0.0';
    row.getCell('status').font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: cores.texto },
    };
  }
  sheet.autoFilter = {
    from: { row: 6, column: 1 },
    to: { row: Math.max(6, 6 + registros.length), column: colunasExcel.length },
  };
  sheet.pageSetup.printTitlesRow = '1:6';
  sheet.pageSetup.printArea = 'A1:O' + Math.max(6, sheet.rowCount);
  sheet.headerFooter.oddFooter = 'Controle de Frotas&CPágina &P de &N';
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
