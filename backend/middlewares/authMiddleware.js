import { verificarToken } from '../services/tokenService.js';
import { buscarUsuario } from '../services/authService.js';
import { ErroHttp } from '../utils/erroHttp.js';
export async function autenticar(req, res, next) {
  const cookie = (req.headers.cookie || '')
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith('frotas_sessao='));
  if (!cookie) throw new ErroHttp(401, 'Entre na sua conta para continuar.');
  let payload;
  try {
    payload = verificarToken(cookie.slice('frotas_sessao='.length));
  } catch {
    throw new ErroHttp(401, 'Sua sessão expirou. Entre novamente.');
  }
  if (typeof payload.sub !== 'string' || !/^[1-9]\d*$/.test(payload.sub))
    throw new ErroHttp(401, 'Sessão inválida.');
  const user = await buscarUsuario(payload.sub);
  if (!user || user.status !== 'active') throw new ErroHttp(401, 'Seu acesso não está ativo.');
  req.usuario = user;
  next();
}
export function autorizar(...perfis) {
  return (req, res, next) => {
    if (!req.usuario || !perfis.includes(req.usuario.perfil))
      throw new ErroHttp(403, 'Você não tem permissão para esta ação.');
    next();
  };
}
export function protegerOrigem(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin && origin !== (process.env.FRONTEND_ORIGIN || 'http://localhost:3000'))
    throw new ErroHttp(403, 'Origem da solicitação não permitida.');
  if (!req.is('application/json')) throw new ErroHttp(415, 'Envie os dados no formato JSON.');
  next();
}
