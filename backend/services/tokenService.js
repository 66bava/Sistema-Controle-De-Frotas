import jwt from 'jsonwebtoken';
const issuer = 'controle-frotas';
const audience = 'controle-frotas-web';
export const duracaoSessao = 60 * 60;
export function validarSegredo() {
  if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET) < 32) {
    throw new Error('Configure JWT_SECRET com pelo menos 32 bytes no backend/.env.');
  }
}
export function gerarToken(usuarioId) {
  validarSegredo();
  return jwt.sign({}, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: String(usuarioId),
    issuer,
    audience,
    expiresIn: duracaoSessao,
  });
}
export function verificarToken(token) {
  validarSegredo();
  return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer, audience });
}
export function opcoesCookie() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}
