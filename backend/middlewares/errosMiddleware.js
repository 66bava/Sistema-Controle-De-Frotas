import { ErroHttp } from '../utils/erroHttp.js';
export function rotaNaoEncontrada(req, res) {
  res.status(404).json({ mensagem: 'Recurso não encontrado.' });
}
export function tratarErros(erro, req, res, next) {
  if (res.headersSent) return next(erro);
  if (erro instanceof ErroHttp) return res.status(erro.status).json({ mensagem: erro.message });
  if (erro.type === 'entity.parse.failed')
    return res.status(400).json({ mensagem: 'Os dados enviados não são válidos.' });
  if (erro.type === 'entity.too.large')
    return res.status(413).json({ mensagem: 'Os dados enviados excedem o limite permitido.' });
  // Não registrar SQL, parâmetros, corpo da requisição, tokens ou credenciais.
  console.error('Falha na API:', { codigo: erro.code || 'INTERNO', tipo: erro.name });
  res.status(500).json({ mensagem: 'Não foi possível processar a solicitação. Tente novamente.' });
}
