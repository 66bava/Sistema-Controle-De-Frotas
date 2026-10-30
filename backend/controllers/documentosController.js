import { buscarParaDocumento } from '../services/ocorrenciasService.js';
import { modeloDocumento } from '../services/documentoModel.js';
import { gerarPdf } from '../services/pdfService.js';
import { gerarHtmlImpressao } from '../services/impressaoService.js';
import { validarId } from '../utils/validacaoCadastros.js';
export async function pdf(req, res) {
  const model = modeloDocumento(await buscarParaDocumento(validarId(req.params.id), req.usuario));
  const buffer = await gerarPdf(model);
  res
    .set({
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'attachment; filename="' + model.codigo + '.pdf"',
    })
    .type('pdf')
    .send(buffer);
}
export async function impressao(req, res) {
  const model = modeloDocumento(await buscarParaDocumento(validarId(req.params.id), req.usuario));
  res.set('Cache-Control', 'private, no-store').type('html').send(gerarHtmlImpressao(model));
}
