import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derivar = promisify(scrypt);
const options = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
export async function gerarHash(senha) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derivar(senha, salt, 64, options);
  return ['scrypt', salt, hash.toString('hex')].join('$');
}
export async function conferirSenha(senha, armazenado) {
  if (typeof senha !== 'string' || typeof armazenado !== 'string') return false;
  const [tipo, salt, hex] = armazenado.split('$');
  if (tipo !== 'scrypt' || !/^[0-9a-f]{32}$/.test(salt || '') || !/^[0-9a-f]{128}$/.test(hex || ''))
    return false;
  const hash = await derivar(senha, salt, 64, options);
  return timingSafeEqual(hash, Buffer.from(hex, 'hex'));
}
