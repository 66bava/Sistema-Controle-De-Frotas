import { feedback } from './api.js';
export function configurarDocumentos(item) {
  const button = document.getElementById('gerar-pdf');
  const print = document.getElementById('imprimir-ocorrencia');
  print.href = '/api/ocorrencias/' + item.id + '/impressao?imprimir=1';
  button.onclick = async () => {
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = 'Gerando PDF…';
    try {
      const response = await fetch('/api/ocorrencias/' + item.id + '/pdf', {
        credentials: 'same-origin',
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) {
        if (response.status === 401) {
          window.location.replace('/');
          return;
        }
        const data = await response.json();
        throw new Error(data.mensagem || 'Não foi possível gerar o PDF.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.codigo + '.pdf';
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      feedback('PDF gerado com sucesso.', 'success');
    } catch (error) {
      feedback(
        error.name === 'TimeoutError' || error instanceof TypeError
          ? 'Não foi possível gerar o PDF. Confira sua conexão e tente novamente.'
          : error.message
      );
    } finally {
      button.disabled = false;
      button.textContent = 'Gerar PDF';
    }
  };
}
