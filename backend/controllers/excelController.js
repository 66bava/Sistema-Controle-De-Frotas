import { validarFiltrosHistorico } from '../utils/filtrosHistorico.js';
import { dadosParaExcel } from '../services/ocorrenciasService.js';
import { gerarExcel } from '../services/excelService.js';
import { Temporal } from '@js-temporal/polyfill';
export async function exportar(req, res) {
  const filtros = validarFiltrosHistorico(req.query, req.usuario);
  const { registros, criterios } = await dadosParaExcel(req.usuario, filtros);
  const buffer = await gerarExcel(registros, { criterios });
  const data = Temporal.Now.zonedDateTimeISO('America/Sao_Paulo').toPlainDate().toString();
  res
    .set({
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'attachment; filename="ocorrencias-transporte-' + data + '.xlsx"',
    })
    .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .send(buffer);
}
