import test from 'node:test';
import assert from 'node:assert/strict';
import { validarAcesso, validarBuscaUsuarios } from '../utils/validacaoUsuarios.js';
test('gestão de usuários valida filtros, perfis e campos permitidos', () => {
  assert.deepEqual(validarAcesso({ perfil: 'viewer', status: 'active' }), {
    perfil: 'viewer',
    status: 'active',
  });
  for (const body of [
    { perfil: 'root', status: 'active' },
    { perfil: 'admin', status: 'pending' },
    { perfil: 'admin', status: 'active', senha: 'x' },
    null,
  ])
    assert.throws(() => validarAcesso(body), { status: 422 });
  assert.equal(validarBuscaUsuarios({ busca: ' Ana ', pagina: '2' }).busca, 'Ana');
  for (const query of [
    { pagina: '-1' },
    { perfil: ['admin'] },
    { status: 'deleted' },
    { ordem: 'senha_hash' },
  ])
    assert.throws(() => validarBuscaUsuarios(query), { status: 422 });
});
