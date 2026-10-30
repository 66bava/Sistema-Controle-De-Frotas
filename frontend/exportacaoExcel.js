export async function baixarExcel(params) {
  const response = await fetch('/api/ocorrencias/exportar-excel?' + params.toString(), {
    credentials: 'same-origin',
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    let data;
    try {
      data = await response.json();
    } catch {}
    const error = new Error(
      data?.mensagem || 'Não foi possível exportar o Excel. Tente novamente.'
    );
    error.status = response.status;
    throw error;
  }
  const blob = await response.blob();
  const cabecalho = response.headers.get('content-disposition') || '';
  const nome =
    cabecalho.match(/filename="(ocorrencias-transporte-\d{4}-\d{2}-\d{2}\.xlsx)"/)?.[1] ||
    'ocorrencias-transporte.xlsx';
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
