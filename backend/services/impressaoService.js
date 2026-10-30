import { escaparHtml as e } from './documentoModel.js';
function celulas(values) {
  return values
    .map(
      ([label, value]) =>
        '<div class="doc-field"><dt>' + e(label) + '</dt><dd>' + e(value) + '</dd></div>'
    )
    .join('');
}
export function gerarHtmlImpressao(doc) {
  return (
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101212"><title>' +
    e(doc.codigo) +
    ' · Controle de Frotas</title><link rel="stylesheet" href="/documento.css"><script type="module" src="/impressao.js"></script></head><body><div class="print-toolbar"><div><strong>Documento da viagem</strong><span id="documento-status" role="status">Preparando impressão…</span></div><button id="imprimir-documento" type="button" disabled>Imprimir documento</button></div><main class="paper"><header class="document-header"><div class="document-brand"><span class="document-mark" aria-hidden="true">F</span><span>Controle de Frotas</span></div><strong class="document-code">' +
    e(doc.codigo) +
    '</strong><h1>OCORRÊNCIAS DIÁRIAS<br>DE TRANSPORTE</h1></header><p class="document-status">' +
    e(doc.status) +
    '</p><section class="document-section"><h2>Identificação</h2><dl class="doc-grid">' +
    celulas(doc.identificacao) +
    '</dl></section><section class="document-section"><h2>Dados da viagem · horário de Brasília</h2><dl class="doc-grid doc-times">' +
    celulas(doc.horarios) +
    '</dl><dl class="doc-grid doc-mileage">' +
    celulas(doc.quilometragem) +
    '</dl></section><section class="document-section"><h2>Itinerário</h2><p class="document-itinerary">' +
    e(doc.itinerario) +
    '</p></section><section class="document-section"><h2>Passageiros</h2>' +
    (doc.passageiros.length
      ? '<ul class="document-passengers">' +
        doc.passageiros.map((nome) => '<li>' + e(nome) + '</li>').join('') +
        '</ul>'
      : '<p>Nenhum passageiro informado.</p>') +
    '</section><section class="document-section document-signature"><h2>Assinatura do condutor</h2>' +
    (doc.assinatura
      ? '<div class="signature-image"><img src="data:image/png;base64,' +
        doc.assinatura.toString('base64') +
        '" alt="Assinatura do condutor vinculada a esta ocorrência"></div>'
      : '<div class="pending-signature" aria-hidden="true"></div>') +
    '<p>' +
    e(doc.assinaturaInfo) +
    '</p></section><footer class="document-footer"><div><span>' +
    e(doc.codigo) +
    ' · Revisão ' +
    e(doc.revisao) +
    '</span><span>Emitido em ' +
    e(doc.emissao) +
    ' · Brasília</span></div><p>' +
    e(doc.nota) +
    '</p></footer></main></body></html>'
  );
}
