const botao = document.getElementById('imprimir-documento');
const status = document.getElementById('documento-status');
function imprimir() {
  window.print();
}
botao.addEventListener('click', imprimir);
try {
  await document.fonts.ready;
  await Promise.all([...document.images].map((img) => img.decode()));
  status.textContent = 'Documento A4 pronto para imprimir.';
  botao.disabled = false;
  if (new URLSearchParams(window.location.search).get('imprimir') === '1') imprimir();
} catch {
  status.textContent =
    'Não foi possível carregar o documento completo. Atualize a página antes de imprimir.';
}
