import test from 'node:test';
import assert from 'node:assert/strict';
import { validarCadastro, validarEmail } from '../utils/validacao.js';
import { gerarHash, conferirSenha } from '../services/senhaService.js';
import { gerarToken, verificarToken } from '../services/tokenService.js';

test('cadastro normaliza e-mail e mantém matrícula opcional', () => {
  const dados = validarCadastro({
    nome: ' Ana Silva ',
    email: ' ANA@EXAMPLE.COM ',
    senha: 'senha-segura-123',
  });
  assert.equal(dados.email, 'ana@example.com');
  assert.equal(dados.nome, 'Ana Silva');
  assert.equal(dados.matricula, null);
});
test('cadastro rejeita permissões enviadas pelo cliente', () => {
  for (const campo of ['perfil', 'status', 'aprovado_por']) {
    assert.throws(
      () =>
        validarCadastro({
          nome: 'Ana',
          email: 'ana@example.com',
          senha: 'senha-segura-123',
          [campo]: 'admin',
        }),
      { status: 422 }
    );
  }
});
test('cadastro rejeita senha curta, campo vazio e e-mail inválido', () => {
  assert.throws(() => validarCadastro({ nome: 'Ana', email: 'ana@example.com', senha: '123' }), {
    status: 422,
  });
  assert.throws(
    () => validarCadastro({ nome: '  ', email: 'ana@example.com', senha: 'senha-segura-123' }),
    { status: 422 }
  );
  assert.throws(() => validarEmail('sem-email'), { status: 422 });
});
test('hash usa salt individual e rejeita senha errada', async () => {
  const first = await gerarHash('senha-segura-123');
  const second = await gerarHash('senha-segura-123');
  assert.notEqual(first, second);
  assert.ok(!first.includes('senha-segura-123'));
  assert.equal(await conferirSenha('senha-segura-123', first), true);
  assert.equal(await conferirSenha('senha-incorreta', first), false);
  assert.equal(await conferirSenha('senha-segura-123', 'hash-invalido'), false);
});
test('JWT valida assinatura e contém somente identidade e claims de sessão', () => {
  process.env.JWT_SECRET = 'chave-exclusiva-para-testes-unitarios-de-jwt-12345';
  const token = gerarToken(42);
  const claims = verificarToken(token);
  assert.equal(claims.sub, '42');
  assert.equal(claims.perfil, undefined);
  assert.equal(claims.senha_hash, undefined);
  assert.throws(() => verificarToken(token.slice(0, -5) + 'XXXXX'));
});
