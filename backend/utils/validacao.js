import { ErroHttp } from './erroHttp.js';
function texto(valor, campo, max, obrigatorio = true) {
  if (valor === undefined && !obrigatorio) return null;
  if (typeof valor !== 'string' || valor.trim().length > max || (obrigatorio && !valor.trim())) {
    throw new ErroHttp(422, 'Confira o campo ' + campo + '.');
  }
  return valor.trim() || null;
}
export function validarEmail(valor) {
  const email = texto(valor, 'e-mail', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new ErroHttp(422, 'Informe um e-mail válido.');
  return email;
}
export function validarSenha(senha) {
  if (typeof senha !== 'string' || senha.length < 10 || senha.length > 128) {
    throw new ErroHttp(422, 'A senha deve ter entre 10 e 128 caracteres.');
  }
  return senha;
}
export function validarCadastro(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new ErroHttp(422, 'Confira os dados do cadastro.');
  if ('perfil' in body || 'status' in body || 'aprovado_por' in body)
    throw new ErroHttp(422, 'O cadastro não permite definir permissões.');
  return {
    nome: texto(body.nome, 'nome', 150),
    email: validarEmail(body.email),
    senha: validarSenha(body.senha),
    matricula: texto(body.matricula, 'matrícula', 50, false),
    funcao: texto(body.funcao, 'função', 100, false),
  };
}
