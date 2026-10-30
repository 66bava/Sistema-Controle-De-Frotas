import { validarCadastro, validarEmail } from '../utils/validacao.js';
import { ErroHttp } from '../utils/erroHttp.js';
import * as auth from '../services/authService.js';
import { gerarToken, duracaoSessao, opcoesCookie } from '../services/tokenService.js';
export async function cadastrar(req, res) {
  await auth.cadastrar(validarCadastro(req.body));
  res
    .status(201)
    .json({ mensagem: 'Cadastro recebido. Aguarde a aprovação do administrador para entrar.' });
}
export async function entrar(req, res) {
  const email = validarEmail(req.body?.email);
  const senha = req.body?.senha;
  if (typeof senha !== 'string' || !senha || senha.length > 128)
    throw new ErroHttp(422, 'Informe sua senha.');
  const usuario = await auth.entrar(email, senha);
  res.cookie('frotas_sessao', gerarToken(usuario.id), {
    ...opcoesCookie(),
    maxAge: duracaoSessao * 1000,
  });
  res.json({ usuario });
}
export function sessao(req, res) {
  res.json({ usuario: auth.usuarioPublico(req.usuario) });
}
export function sair(req, res) {
  res.clearCookie('frotas_sessao', opcoesCookie());
  res.json({ mensagem: 'Você saiu da sua conta.' });
}
export async function pendentes(req, res) {
  res.json({ usuarios: await auth.listarPendentes() });
}
export async function aprovar(req, res) {
  if (!/^[1-9]\d*$/.test(req.params.id) || Number(req.params.id) > 4294967295)
    throw new ErroHttp(422, 'Usuário inválido.');
  await auth.aprovar(Number(req.params.id), req.usuario.id);
  res.json({ mensagem: 'Condutor aprovado. O acesso já está liberado.' });
}
