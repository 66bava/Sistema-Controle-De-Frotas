import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { obterConexao } from '../database/conexao.js';
import { criarPrimeiroAdmin } from '../services/primeiroAdminService.js';
if (!process.stdin.isTTY) {
  console.error('Execute em um terminal interativo: npm.cmd run criar-admin');
  process.exit(1);
}
let ocultar = false;
let pool;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!ocultar) process.stdout.write(chunk);
    callback();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: true });
try {
  console.log('Criação local do primeiro administrador. A senha não será exibida.');
  const nome = await rl.question('Nome: ');
  const email = await rl.question('E-mail: ');
  const perguntaSenha = rl.question('Senha (mínimo 10 caracteres): ');
  ocultar = true;
  const senha = await perguntaSenha;
  ocultar = false;
  process.stdout.write('\n');
  const perguntaConfirmar = rl.question('Confirme a senha: ');
  ocultar = true;
  const confirmar = await perguntaConfirmar;
  ocultar = false;
  process.stdout.write('\n');
  if (senha !== confirmar) throw new Error('As senhas não conferem.');
  pool = obterConexao();
  await criarPrimeiroAdmin({ nome, email, senha });
  console.log('Administrador criado. Entre pelo navegador.');
} catch (error) {
  console.error(
    error.code ? 'Não foi possível criar o administrador. Código: ' + error.code : error.message
  );
  process.exitCode = 1;
} finally {
  ocultar = false;
  rl.close();
  if (pool) await pool.end();
}
