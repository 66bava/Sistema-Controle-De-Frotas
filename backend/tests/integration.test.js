import ExcelJS from 'exceljs';
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { PNG } from 'pngjs';
import app from '../app.js';
import { obterConexao } from '../database/conexao.js';
import { gerarHash } from '../services/senhaService.js';
import { criarPrimeiroAdmin } from '../services/primeiroAdminService.js';
import { gerarToken } from '../services/tokenService.js';

test(
  'autenticação e aprovação integradas ao MySQL',
  { skip: process.env.MYSQL_INTEGRATION !== '1' },
  async (t) => {
    assert.match(
      process.env.DB_NAME || '',
      /_test$/,
      'Testes exigem banco exclusivo terminado em _test'
    );
    assert.ok(process.env.JWT_SECRET?.length >= 32, 'Configure chave exclusiva de teste');
    const pool = obterConexao();
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    process.env.FRONTEND_ORIGIN = base;
    const senha = 'Senha-ficticia-teste-123';
    let adminCookie, driverCookie, driverId;
    async function request(route, { method = 'GET', data, cookie, origin } = {}) {
      const response = await fetch(base + '/api' + route, {
        method,
        headers: {
          ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
          ...(origin ? { Origin: origin } : {}),
        },
        body: method !== 'GET' ? JSON.stringify(data || {}) : undefined,
      });
      return {
        response,
        data: await response.json(),
        cookie: response.headers.get('set-cookie')?.split(';')[0],
      };
    }
    try {
      const hash = await gerarHash(senha);
      let admin;
      await t.test(
        'primeiro administrador é criado localmente com auditoria e sem duplicar',
        async () => {
          const id = await criarPrimeiroAdmin({
            nome: 'Admin Teste',
            email: 'admin@example.invalid',
            senha,
          });
          admin = { insertId: id };
          const [rows] = await pool.execute(
            'SELECT perfil, status, senha_hash FROM usuarios WHERE id=?',
            [id]
          );
          assert.equal(rows[0].perfil, 'admin');
          assert.equal(rows[0].status, 'active');
          assert.notEqual(rows[0].senha_hash, senha);
          const [audit] = await pool.execute(
            "SELECT id FROM auditoria WHERE acao='criar_primeiro_admin' AND entidade_id=?",
            [id]
          );
          assert.equal(audit.length, 1);
          await assert.rejects(
            () =>
              criarPrimeiroAdmin({ nome: 'Outro Admin', email: 'outro@example.invalid', senha }),
            { status: 409 }
          );
        }
      );
      const [viewer] = await pool.execute(
        "INSERT INTO usuarios (nome,email,senha_hash,perfil,status) VALUES (?, ?, ?, 'viewer', 'active')",
        ['Viewer Teste', 'viewer@example.invalid', hash]
      );
      await t.test('sessão exige autenticação', async () => {
        assert.equal((await request('/auth/sessao')).response.status, 401);
      });
      await t.test('cadastro não aceita autoelevação', async () => {
        const result = await request('/auth/cadastro', {
          method: 'POST',
          data: { nome: 'Fraude', email: 'fraude@example.invalid', senha, perfil: 'admin' },
        });
        assert.equal(result.response.status, 422);
      });
      await t.test('cadastro persiste como driver pendente sem expor hash', async () => {
        const result = await request('/auth/cadastro', {
          method: 'POST',
          data: { nome: 'Condutor Teste', email: 'DRIVER@example.invalid', senha },
        });
        assert.equal(result.response.status, 201);
        assert.equal(result.cookie, undefined);
        assert.equal(JSON.stringify(result.data).includes('scrypt'), false);
        const [rows] = await pool.query(
          "SELECT id, perfil, status, senha_hash FROM usuarios WHERE email='driver@example.invalid'"
        );
        driverId = rows[0].id;
        assert.equal(rows[0].perfil, 'driver');
        assert.equal(rows[0].status, 'pending');
        assert.notEqual(rows[0].senha_hash, senha);
      });
      await t.test('cadastro duplicado é tratado', async () => {
        assert.equal(
          (
            await request('/auth/cadastro', {
              method: 'POST',
              data: { nome: 'Duplicado', email: 'driver@example.invalid', senha },
            })
          ).response.status,
          409
        );
      });
      await t.test('pendente não entra; credencial incorreta não entra', async () => {
        assert.equal(
          (
            await request('/auth/login', {
              method: 'POST',
              data: { email: 'driver@example.invalid', senha },
            })
          ).response.status,
          403
        );
        assert.equal(
          (
            await request('/auth/login', {
              method: 'POST',
              data: { email: 'admin@example.invalid', senha: 'senha-errada' },
            })
          ).response.status,
          401
        );
      });
      await t.test(
        'admin recebe cookie HttpOnly e SameSite; resposta não contém hash',
        async () => {
          const result = await request('/auth/login', {
            method: 'POST',
            data: { email: 'admin@example.invalid', senha },
          });
          assert.equal(result.response.status, 200);
          adminCookie = result.cookie;
          assert.match(result.response.headers.get('set-cookie'), /HttpOnly/i);
          assert.match(result.response.headers.get('set-cookie'), /SameSite=Strict/i);
          assert.equal(result.data.usuario.senha_hash, undefined);
        }
      );
      await t.test('admin lista e aprova; auditoria fica registrada', async () => {
        const result = await request('/usuarios/pendentes', { cookie: adminCookie });
        assert.equal(result.response.status, 200);
        assert.equal(result.data.usuarios.length, 1);
        assert.equal(
          (
            await request('/usuarios/' + driverId + '/aprovar', {
              method: 'POST',
              cookie: adminCookie,
            })
          ).response.status,
          200
        );
        const [rows] = await pool.execute('SELECT status, aprovado_por FROM usuarios WHERE id=?', [
          driverId,
        ]);
        assert.equal(rows[0].status, 'active');
        assert.equal(rows[0].aprovado_por, admin.insertId);
        const [audit] = await pool.execute(
          "SELECT id FROM auditoria WHERE entidade_id=? AND acao='aprovar_cadastro'",
          [driverId]
        );
        assert.equal(audit.length, 1);
      });
      await t.test('aprovação repetida retorna conflito; ID inexistente retorna 404', async () => {
        assert.equal(
          (
            await request('/usuarios/' + driverId + '/aprovar', {
              method: 'POST',
              cookie: adminCookie,
            })
          ).response.status,
          409
        );
        assert.equal(
          (await request('/usuarios/4294967295/aprovar', { method: 'POST', cookie: adminCookie }))
            .response.status,
          404
        );
      });
      await t.test('driver aprovado entra e não acessa funções administrativas', async () => {
        const result = await request('/auth/login', {
          method: 'POST',
          data: { email: 'driver@example.invalid', senha },
        });
        assert.equal(result.response.status, 200);
        driverCookie = result.cookie;
        assert.equal(
          (await request('/usuarios/pendentes', { cookie: driverCookie })).response.status,
          403
        );
        assert.equal(
          (
            await request('/usuarios/' + driverId + '/aprovar', {
              method: 'POST',
              cookie: driverCookie,
            })
          ).response.status,
          403
        );
      });
      await t.test('viewer também não aprova nem lista cadastros administrativos', async () => {
        const result = await request('/auth/login', {
          method: 'POST',
          data: { email: 'viewer@example.invalid', senha },
        });
        assert.equal(result.response.status, 200);
        assert.equal(
          (await request('/usuarios/pendentes', { cookie: result.cookie })).response.status,
          403
        );
      });
      let veiculoCadastroId, setorCadastroId;
      const veiculoCadastro = {
        marca: 'Marca Teste',
        modelo: 'Modelo Teste',
        placa: 'TST9A01',
        numero_interno: 'TESTE-API',
        ativo: true,
      };
      await t.test('cadastros exigem admin em todas as operações', async () => {
        assert.equal((await request('/veiculos')).response.status, 401);
        const viewerResult = await request('/auth/login', {
          method: 'POST',
          data: { email: 'viewer@example.invalid', senha },
        });
        for (const cookie of [driverCookie, viewerResult.cookie]) {
          for (const tipo of ['veiculos', 'setores']) {
            for (const [method, route] of [
              ['GET', '/' + tipo],
              ['GET', '/' + tipo + '/1'],
              ['POST', '/' + tipo],
              ['PUT', '/' + tipo + '/1'],
            ]) {
              assert.equal(
                (await request(route, { method, cookie, data: {} })).response.status,
                403
              );
            }
          }
          assert.equal(
            (await request('/veiculos/1', { method: 'DELETE', cookie })).response.status,
            403
          );
        }
      });
      await t.test('admin cria, consulta, edita e desativa veículo com auditoria', async () => {
        const created = await request('/veiculos', {
          method: 'POST',
          cookie: adminCookie,
          data: { ...veiculoCadastro, placa: 'tst-9a01' },
        });
        assert.equal(created.response.status, 201);
        veiculoCadastroId = created.data.registro.id;
        assert.equal(created.data.registro.placa, 'TST9A01');
        const listed = await request('/veiculos', { cookie: adminCookie });
        assert.ok(listed.data.veiculos.some((v) => v.id === veiculoCadastroId));
        assert.equal(
          (await request('/veiculos/' + veiculoCadastroId, { cookie: adminCookie })).response
            .status,
          200
        );
        const updated = await request('/veiculos/' + veiculoCadastroId, {
          method: 'PUT',
          cookie: adminCookie,
          data: { ...veiculoCadastro, modelo: 'Modelo atualizado', ativo: false },
        });
        assert.equal(updated.response.status, 200);
        assert.equal(updated.data.registro.ativo, false);
        const [audit] = await pool.execute(
          "SELECT acao, detalhes FROM auditoria WHERE entidade='veiculos' AND entidade_id=? ORDER BY id",
          [veiculoCadastroId]
        );
        assert.equal(audit.length, 2);
        assert.equal(audit[1].detalhes.antes.ativo, true);
        assert.equal(audit[1].detalhes.depois.ativo, false);
        assert.equal(
          (
            await request('/veiculos/' + veiculoCadastroId, {
              method: 'PUT',
              cookie: adminCookie,
              data: veiculoCadastro,
            })
          ).response.status,
          200
        );
      });
      await t.test('duplicidade e dados inválidos não criam cadastros nem auditoria', async () => {
        assert.equal(
          (
            await request('/veiculos', {
              method: 'POST',
              cookie: adminCookie,
              data: veiculoCadastro,
            })
          ).response.status,
          409
        );
        assert.equal(
          (
            await request('/veiculos', {
              method: 'POST',
              cookie: adminCookie,
              data: { ...veiculoCadastro, placa: 'INVALIDA' },
            })
          ).response.status,
          422
        );
        assert.equal(
          (
            await request('/veiculos/-1', {
              method: 'PUT',
              cookie: adminCookie,
              data: veiculoCadastro,
            })
          ).response.status,
          422
        );
        assert.equal(
          (await request('/veiculos/4294967295', { cookie: adminCookie })).response.status,
          404
        );
      });
      await t.test(
        'setor é criado, editado, desativado e reativado sem apagar registros',
        async () => {
          const created = await request('/setores', {
            method: 'POST',
            cookie: adminCookie,
            data: { nome: 'Setor Teste API' },
          });
          assert.equal(created.response.status, 201);
          setorCadastroId = created.data.registro.id;
          assert.equal(
            (
              await request('/setores', {
                method: 'POST',
                cookie: adminCookie,
                data: { nome: 'Setor Teste API' },
              })
            ).response.status,
            409
          );
          const updated = await request('/setores/' + setorCadastroId, {
            method: 'PUT',
            cookie: adminCookie,
            data: { nome: 'Setor Atualizado API', ativo: false },
          });
          assert.equal(updated.response.status, 200);
          assert.equal(updated.data.registro.ativo, false);
          assert.equal(
            (
              await request('/setores/' + setorCadastroId, {
                method: 'PUT',
                cookie: adminCookie,
                data: { nome: 'Setor Atualizado API', ativo: true },
              })
            ).response.status,
            200
          );
          const list = await request('/setores', { cookie: adminCookie });
          assert.ok(list.data.setores.some((s) => s.id === setorCadastroId));
        }
      );
      await t.test('DELETE arquiva veículo e preserva ocorrência vinculada', async () => {
        const [trip] = await pool.execute(
          "INSERT INTO ocorrencias (veiculo_id, condutor_id, setor_id, criado_por, saida_em, km_inicial, itinerario) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3), 100, 'Viagem de teste')",
          [veiculoCadastroId, driverId, setorCadastroId, driverId]
        );
        assert.equal(
          (
            await request('/veiculos/' + veiculoCadastroId, {
              method: 'DELETE',
              cookie: adminCookie,
            })
          ).response.status,
          200
        );
        const [rows] = await pool.execute('SELECT ativo, excluido_em FROM veiculos WHERE id=?', [
          veiculoCadastroId,
        ]);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].ativo, 0);
        assert.ok(rows[0].excluido_em);
        const [trips] = await pool.execute('SELECT id FROM ocorrencias WHERE id=?', [
          trip.insertId,
        ]);
        assert.equal(trips.length, 1);
        assert.equal(
          (await request('/veiculos/' + veiculoCadastroId, { cookie: adminCookie })).response
            .status,
          404
        );
        assert.equal(
          (
            await request('/veiculos/' + veiculoCadastroId, {
              method: 'PUT',
              cookie: adminCookie,
              data: veiculoCadastro,
            })
          ).response.status,
          404
        );
        const list = await request('/veiculos', { cookie: adminCookie });
        assert.ok(!list.data.veiculos.some((v) => v.id === veiculoCadastroId));
        assert.equal(
          (
            await request('/veiculos', {
              method: 'POST',
              cookie: adminCookie,
              data: veiculoCadastro,
            })
          ).response.status,
          409
        );
      });
      await t.test('JWT adulterado ou expirado é rejeitado', async () => {
        assert.equal(
          (await request('/auth/sessao', { cookie: 'frotas_sessao=invalido' })).response.status,
          401
        );
        const expired = jwt.sign({}, process.env.JWT_SECRET, {
          subject: String(driverId),
          issuer: 'controle-frotas',
          audience: 'controle-frotas-web',
          expiresIn: -1,
        });
        assert.equal(
          (await request('/auth/sessao', { cookie: 'frotas_sessao=' + expired })).response.status,
          401
        );
      });
      await t.test('inativar usuário bloqueia sessão já emitida', async () => {
        await pool.execute("UPDATE usuarios SET status='inactive' WHERE id=?", [driverId]);
        assert.equal(
          (await request('/auth/sessao', { cookie: driverCookie })).response.status,
          401
        );
      });
      await t.test(
        'origem externa é rejeitada e JSON inválido recebe mensagem legível',
        async () => {
          assert.equal(
            (
              await request('/auth/logout', {
                method: 'POST',
                cookie: adminCookie,
                origin: 'https://externo.invalid',
              })
            ).response.status,
            403
          );
          const malformed = await fetch(base + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{quebrado',
          });
          assert.equal(malformed.status, 400);
        }
      );
      await t.test('logout remove cookie', async () => {
        const result = await request('/auth/logout', { method: 'POST', cookie: adminCookie });
        assert.equal(result.response.status, 200);
        assert.match(result.response.headers.get('set-cookie'), /frotas_sessao=;/);
      });
      const driversViagem = [];
      for (const nome of ['Saída A', 'Saída B', 'Saída C']) {
        const [result] = await pool.execute(
          "INSERT INTO usuarios (nome,email,senha_hash,perfil,status) VALUES (?, ?, ?, 'driver', 'active')",
          [nome, nome.replaceAll(' ', '') + '@example.invalid', hash]
        );
        driversViagem.push({
          id: result.insertId,
          cookie: 'frotas_sessao=' + gerarToken(result.insertId),
        });
      }
      const [driverA, driverB, driverC] = driversViagem;
      const inicio = {
        veiculo_id: 1,
        setor_id: 1,
        saida_em: '2026-10-29T23:30',
        km_inicial: 100.5,
        itinerario: 'Sede → cliente → sede',
        passageiros: ['Maria Teste', 'João Teste'],
      };
      let viagemId;
      await t.test(
        'opções incluem apenas ativos sem expor dados de outros condutores',
        async () => {
          await pool.query('UPDATE veiculos SET ativo=0 WHERE id=3');
          await pool.query('UPDATE setores SET ativo=0 WHERE id=3');
          try {
            const result = await request('/ocorrencias/opcoes', { cookie: driverA.cookie });
            assert.equal(result.response.status, 200);
            assert.ok(!result.data.veiculos.some((v) => v.id === 3));
            assert.ok(!result.data.setores.some((s) => s.id === 3));
            assert.equal(result.data.veiculos[0].condutor_id, undefined);
            assert.equal(
              (
                await request('/ocorrencias', {
                  method: 'POST',
                  cookie: driverA.cookie,
                  data: { ...inicio, veiculo_id: 3 },
                })
              ).response.status,
              422
            );
            assert.equal(
              (
                await request('/ocorrencias', {
                  method: 'POST',
                  cookie: driverA.cookie,
                  data: { ...inicio, setor_id: 3 },
                })
              ).response.status,
              422
            );
          } finally {
            await pool.query('UPDATE veiculos SET ativo=1 WHERE id=3');
            await pool.query('UPDATE setores SET ativo=1 WHERE id=3');
          }
        }
      );
      await t.test('somente condutor ativo pode iniciar sua própria ocorrência', async () => {
        assert.equal(
          (await request('/ocorrencias', { method: 'POST', data: inicio })).response.status,
          401
        );
        assert.equal(
          (await request('/ocorrencias', { method: 'POST', cookie: adminCookie, data: inicio }))
            .response.status,
          403
        );
        assert.equal(
          (
            await request('/ocorrencias', {
              method: 'POST',
              cookie: driverA.cookie,
              data: { ...inicio, condutor_id: driverB.id },
            })
          ).response.status,
          422
        );
        assert.equal(
          (
            await request('/ocorrencias', {
              method: 'POST',
              cookie: driverA.cookie,
              data: { ...inicio, km_inicial: -1 },
            })
          ).response.status,
          422
        );
      });
      await t.test(
        'início persiste horário UTC, passageiros e auditoria em transação',
        async () => {
          const result = await request('/ocorrencias', {
            method: 'POST',
            cookie: driverA.cookie,
            data: inicio,
          });
          assert.equal(result.response.status, 201);
          const item = result.data.ocorrencia;
          viagemId = item.id;
          assert.match(item.codigo, /^OC-\d{6,}$/);
          assert.equal(item.condutor_id, driverA.id);
          assert.equal(item.status, 'in_progress');
          assert.equal(item.distancia_km, null);
          assert.equal(item.saida_em, '2026-10-30T02:30:00.000Z');
          assert.deepEqual(item.passageiros, inicio.passageiros);
          const [audit] = await pool.execute(
            "SELECT id FROM auditoria WHERE ocorrencia_id=? AND acao='iniciar_viagem'",
            [viagemId]
          );
          assert.equal(audit.length, 1);
        }
      );
      await t.test('nova viagem é bloqueada para condutor ocupado ou veículo ocupado', async () => {
        assert.equal(
          (
            await request('/ocorrencias', {
              method: 'POST',
              cookie: driverA.cookie,
              data: { ...inicio, veiculo_id: 2 },
            })
          ).response.status,
          409
        );
        const busy = await request('/ocorrencias', {
          method: 'POST',
          cookie: driverB.cookie,
          data: inicio,
        });
        assert.equal(busy.response.status, 409);
        assert.equal(JSON.stringify(busy.data).includes(String(driverA.id) + 'condutor'), false);
        const [rows] = await pool.execute(
          "SELECT COUNT(*) AS total FROM ocorrencias WHERE condutor_id=? AND status='in_progress'",
          [driverA.id]
        );
        assert.equal(rows[0].total, 1);
      });
      await t.test(
        'requisições concorrentes para o mesmo veículo geram uma única viagem',
        async () => {
          const results = await Promise.all(
            [driverB, driverC].map((driver) =>
              request('/ocorrencias', {
                method: 'POST',
                cookie: driver.cookie,
                data: { ...inicio, veiculo_id: 2, passageiros: [] },
              })
            )
          );
          assert.deepEqual(results.map((r) => r.response.status).sort(), [201, 409]);
          const [rows] = await pool.query(
            "SELECT COUNT(*) AS total FROM ocorrencias WHERE veiculo_id=2 AND status='in_progress'"
          );
          assert.equal(rows[0].total, 1);
        }
      );
      await t.test(
        'lista e detalhes respeitam privacidade; administrador pode consultar',
        async () => {
          assert.equal(
            (await request('/ocorrencias/' + viagemId, { cookie: driverB.cookie })).response.status,
            404
          );
          assert.equal(
            (await request('/ocorrencias/' + viagemId, { cookie: adminCookie })).response.status,
            200
          );
          const mine = await request('/ocorrencias', { cookie: driverA.cookie });
          assert.equal(mine.data.ocorrencias.length, 1);
          assert.equal(mine.data.ocorrencias[0].id, viagemId);
          assert.equal(
            (await request('/ocorrencias/4294967295', { cookie: driverA.cookie })).response.status,
            404
          );
        }
      );
      const pngAssinatura = new PNG({ width: 240, height: 100 });
      pngAssinatura.data.fill(255);
      for (let x = 20; x < 200; x++)
        for (let dy = 0; dy < 3; dy++) {
          const y = 40 + Math.round(20 * Math.sin(x / 12));
          const i = ((y + dy) * 240 + x) * 4;
          pngAssinatura.data[i] = pngAssinatura.data[i + 1] = pngAssinatura.data[i + 2] = 20;
        }
      const assinatura =
        'data:image/png;base64,' + PNG.sync.write(pngAssinatura).toString('base64');
      let revisaoChegada;
      await t.test('chegada exige autoria e não aceita km/horário inferiores', async () => {
        const dados = { chegada_em: '2026-10-30T01:00', km_final: 125.5 };
        assert.equal(
          (
            await request('/ocorrencias/' + viagemId + '/chegada', {
              method: 'PUT',
              cookie: adminCookie,
              data: dados,
            })
          ).response.status,
          403
        );
        assert.equal(
          (
            await request('/ocorrencias/' + viagemId + '/chegada', {
              method: 'PUT',
              cookie: driverB.cookie,
              data: dados,
            })
          ).response.status,
          404
        );
        assert.equal(
          (
            await request('/ocorrencias/' + viagemId + '/chegada', {
              method: 'PUT',
              cookie: driverA.cookie,
              data: { ...dados, km_final: 99 },
            })
          ).response.status,
          422
        );
        assert.equal(
          (
            await request('/ocorrencias/' + viagemId + '/chegada', {
              method: 'PUT',
              cookie: driverA.cookie,
              data: { ...dados, chegada_em: '2026-10-29T22:00' },
            })
          ).response.status,
          422
        );
        assert.equal(
          (
            await request('/ocorrencias/' + viagemId + '/assinatura', {
              method: 'POST',
              cookie: driverA.cookie,
              data: { assinatura, revisao: 1 },
            })
          ).response.status,
          422
        );
      });
      await t.test('chegada é salva no dia seguinte sem concluir e mantém o bloqueio', async () => {
        const result = await request('/ocorrencias/' + viagemId + '/chegada', {
          method: 'PUT',
          cookie: driverA.cookie,
          data: { chegada_em: '2026-10-30T01:00', km_final: 125.5 },
        });
        assert.equal(result.response.status, 200);
        assert.equal(result.data.ocorrencia.chegada_em, '2026-10-30T04:00:00.000Z');
        assert.equal(result.data.ocorrencia.distancia_km, 25);
        assert.equal(result.data.ocorrencia.status, 'in_progress');
        revisaoChegada = result.data.ocorrencia.revisao;
        assert.equal(
          (
            await request('/ocorrencias', {
              method: 'POST',
              cookie: driverA.cookie,
              data: { ...inicio, veiculo_id: 3 },
            })
          ).response.status,
          409
        );
        assert.equal(
          (
            await request('/ocorrencias/' + viagemId + '/assinatura', {
              method: 'POST',
              cookie: driverA.cookie,
              data: { assinatura: '', revisao: revisaoChegada },
            })
          ).response.status,
          422
        );
      });
      await t.test('mudança de chegada invalida assinatura de revisão anterior', async () => {
        const result = await request('/ocorrencias/' + viagemId + '/chegada', {
          method: 'PUT',
          cookie: driverA.cookie,
          data: { chegada_em: '2026-10-30T01:10', km_final: 126.5 },
        });
        assert.equal(result.response.status, 200);
        assert.equal(
          (
            await request('/ocorrencias/' + viagemId + '/assinatura', {
              method: 'POST',
              cookie: driverA.cookie,
              data: { assinatura, revisao: revisaoChegada },
            })
          ).response.status,
          409
        );
        revisaoChegada = result.data.ocorrencia.revisao;
        const repetido = await request('/ocorrencias/' + viagemId + '/chegada', {
          method: 'PUT',
          cookie: driverA.cookie,
          data: { chegada_em: '2026-10-30T01:10', km_final: 126.5 },
        });
        assert.equal(repetido.data.ocorrencia.revisao, revisaoChegada);
      });
      await t.test(
        'apenas o condutor pode assinar; conclusão concorrente registra uma vez',
        async () => {
          const dados = { assinatura, revisao: revisaoChegada };
          assert.equal(
            (
              await request('/ocorrencias/' + viagemId + '/assinatura', {
                method: 'POST',
                cookie: adminCookie,
                data: dados,
              })
            ).response.status,
            403
          );
          assert.equal(
            (
              await request('/ocorrencias/' + viagemId + '/assinatura', {
                method: 'POST',
                cookie: driverB.cookie,
                data: dados,
              })
            ).response.status,
            404
          );
          const results = await Promise.all(
            [1, 2].map(() =>
              request('/ocorrencias/' + viagemId + '/assinatura', {
                method: 'POST',
                cookie: driverA.cookie,
                data: dados,
              })
            )
          );
          assert.deepEqual(results.map((r) => r.response.status).sort(), [200, 409]);
          const completed = results.find((r) => r.response.status === 200).data.ocorrencia;
          assert.equal(completed.status, 'completed');
          assert.equal(completed.distancia_km, 26);
          assert.equal(completed.assinado_por, driverA.id);
          assert.ok(completed.assinado_em);
          const [audit] = await pool.execute(
            "SELECT acao FROM auditoria WHERE ocorrencia_id=? AND acao IN ('assinar_ocorrencia', 'concluir_viagem')",
            [viagemId]
          );
          assert.equal(audit.length, 2);
          assert.equal(
            (
              await request('/ocorrencias/' + viagemId + '/chegada', {
                method: 'PUT',
                cookie: driverA.cookie,
                data: { chegada_em: '2026-10-30T02:00', km_final: 130 },
              })
            ).response.status,
            409
          );
        }
      );
      await t.test('imagem salva é protegida e conclusão libera a próxima viagem', async () => {
        const response = await fetch(base + '/api/ocorrencias/' + viagemId + '/assinatura', {
          headers: { Cookie: driverA.cookie },
        });
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type'), /image\/png/);
        assert.equal(PNG.sync.read(Buffer.from(await response.arrayBuffer())).width, 240);
        assert.equal(
          (
            await fetch(base + '/api/ocorrencias/' + viagemId + '/assinatura', {
              headers: { Cookie: driverB.cookie },
            })
          ).status,
          404
        );
        assert.equal(
          (await fetch(base + '/api/ocorrencias/' + viagemId + '/assinatura')).status,
          401
        );
        const nova = await request('/ocorrencias', {
          method: 'POST',
          cookie: driverA.cookie,
          data: { ...inicio, saida_em: '2026-10-30T02:00', km_inicial: 126.5, passageiros: [] },
        });
        assert.equal(nova.response.status, 201);
      });
      // Fixtures exclusivas do banco temporário para testar histórico além da primeira página.
      const historicoIds = [];
      async function historica(saida, itinerario, veiculo = 1, setor = 1) {
        const [row] = await pool.execute(
          "INSERT INTO ocorrencias (veiculo_id,condutor_id,setor_id,criado_por,saida_em,chegada_em,km_inicial,km_final,itinerario,status,assinatura_condutor,assinado_por,assinado_em) VALUES (?, ?, ?, ?, ?, DATE_ADD(?, INTERVAL 1 HOUR), 100, 110, ?, 'completed', ?, ?, UTC_TIMESTAMP(3))",
          [
            veiculo,
            driverA.id,
            setor,
            driverA.id,
            saida,
            saida,
            itinerario,
            PNG.sync.write(pngAssinatura),
            driverA.id,
          ]
        );
        historicoIds.push(row.insertId);
        return row.insertId;
      }
      for (let n = 1; n <= 25; n++)
        await historica(
          '2026-09-' + String(n).padStart(2, '0') + ' 15:00:00',
          'Pesquisa HIST_100% = literal ' + String(n).padStart(2, '0')
        );
      const ultimoDia = await historica('2026-10-30 02:59:59.999', 'Limite local dentro');
      await historica('2026-10-30 03:00:00.000', 'Limite local fora');
      await historica('2026-09-27 15:00:00', 'HISTx100XYZ contraprova');
      await historica('2026-09-28 15:00:00', 'Cadastro histórico inativo', 3, 3);
      function urlHistorico(filtros) {
        return '/ocorrencias?' + new URLSearchParams(filtros).toString();
      }
      await t.test(
        'paginação permite alcançar todo o histórico sem repetir registros',
        async () => {
          const a = await request(urlHistorico({ limite: '7', pagina: '1' }), {
            cookie: driverA.cookie,
          });
          const b = await request(urlHistorico({ limite: '7', pagina: '2' }), {
            cookie: driverA.cookie,
          });
          assert.equal(a.response.status, 200);
          assert.equal(a.data.ocorrencias.length, 7);
          assert.ok(a.data.total > 20);
          assert.equal(a.data.paginas, Math.ceil(a.data.total / 7));
          assert.ok(
            b.data.ocorrencias.every(
              (row) => !a.data.ocorrencias.some((first) => first.id === row.id)
            )
          );
          const last = await request(urlHistorico({ limite: '7', pagina: '999999' }), {
            cookie: driverA.cookie,
          });
          assert.equal(last.data.pagina, last.data.paginas);
          assert.ok(last.data.ocorrencias.length > 0);
        }
      );
      await t.test(
        'data final inclui a última fração de segundo do dia local, sem incluir o dia seguinte',
        async () => {
          const result = await request(
            urlHistorico({
              data_inicial: '2026-10-29',
              data_final: '2026-10-29',
              busca: 'Limite local',
            }),
            { cookie: driverA.cookie }
          );
          assert.equal(result.response.status, 200);
          assert.equal(result.data.total, 1);
          assert.equal(result.data.ocorrencias[0].id, ultimoDia);
          assert.equal(
            (
              await request(
                urlHistorico({ data_inicial: '2026-10-30', data_final: '2026-10-29' }),
                { cookie: driverA.cookie }
              )
            ).response.status,
            422
          );
        }
      );
      await t.test(
        'pesquisa trata % e _ como texto, encontra código e passageiros, e não executa SQL',
        async () => {
          const literal = await request(urlHistorico({ busca: 'HIST_100%' }), {
            cookie: driverA.cookie,
          });
          assert.equal(literal.data.total, 25);
          const code = 'OC-' + String(viagemId).padStart(6, '0');
          const codigo = await request(urlHistorico({ busca: code }), { cookie: driverA.cookie });
          assert.equal(codigo.data.total, 1);
          assert.equal(codigo.data.ocorrencias[0].id, viagemId);
          const passageiro = await request(urlHistorico({ busca: 'Maria Teste' }), {
            cookie: driverA.cookie,
          });
          assert.ok(passageiro.data.ocorrencias.some((row) => row.id === viagemId));
          const injection = await request(urlHistorico({ busca: "' OR 1=1 --" }), {
            cookie: driverA.cookie,
          });
          assert.equal(injection.data.total, 0);
        }
      );
      await t.test('combina filtros e não perde o bloqueio da viagem em andamento', async () => {
        const result = await request(
          urlHistorico({
            busca: 'HIST_100%',
            condutor_id: String(driverA.id),
            veiculo_id: '1',
            setor_id: '1',
            status: 'completed',
            data_inicial: '2026-09-01',
            data_final: '2026-09-10',
          }),
          { cookie: adminCookie }
        );
        assert.equal(result.response.status, 200);
        assert.equal(result.data.total, 10);
        assert.ok(
          result.data.ocorrencias.every(
            (row) => row.condutor_id === driverA.id && row.status === 'completed'
          )
        );
        const onlyCompleted = await request(
          urlHistorico({ status: 'completed', busca: 'nada-encontrado' }),
          { cookie: driverA.cookie }
        );
        assert.equal(onlyCompleted.data.total, 0);
        assert.ok(onlyCompleted.data.em_andamento?.id);
        assert.equal(
          (
            await request(urlHistorico({ condutor_id: String(driverB.id) }), {
              cookie: driverA.cookie,
            })
          ).response.status,
          403
        );
        const viewerCookie = 'frotas_sessao=' + gerarToken(viewer.insertId);
        assert.equal(
          (
            await request(urlHistorico({ condutor_id: String(driverA.id), busca: 'HIST_100%' }), {
              cookie: viewerCookie,
            })
          ).data.total,
          25
        );
      });
      await t.test(
        'filtros preservam cadastros históricos e respeitam a privacidade do condutor',
        async () => {
          await pool.query('UPDATE veiculos SET ativo=0 WHERE id=3');
          await pool.query('UPDATE setores SET ativo=0 WHERE id=3');
          try {
            const mine = await request('/ocorrencias/filtros', { cookie: driverA.cookie });
            assert.ok(mine.data.veiculos.some((v) => v.id === 3 && !v.ativo));
            assert.ok(mine.data.setores.some((s) => s.id === 3 && !s.ativo));
            assert.deepEqual(
              mine.data.condutores.map((u) => u.id),
              [driverA.id]
            );
            assert.ok(!mine.data.veiculos.some((v) => v.id === veiculoCadastroId));
            const all = await request('/ocorrencias/filtros', { cookie: adminCookie });
            assert.ok(all.data.veiculos.some((v) => v.id === veiculoCadastroId && v.excluido_em));
          } finally {
            await pool.query('UPDATE veiculos SET ativo=1 WHERE id=3');
            await pool.query('UPDATE setores SET ativo=1 WHERE id=3');
          }
        }
      );
      await t.test(
        'Excel exige admin e exporta todos os resultados além da paginação',
        async () => {
          const path =
            '/api/ocorrencias/exportar-excel?' +
            new URLSearchParams({ busca: 'HIST_100%', pagina: '2', limite: '1' });
          assert.equal((await fetch(base + path)).status, 401);
          assert.equal(
            (await fetch(base + path, { headers: { Cookie: driverA.cookie } })).status,
            403
          );
          assert.equal(
            (
              await fetch(base + path, {
                headers: { Cookie: 'frotas_sessao=' + gerarToken(viewer.insertId) },
              })
            ).status,
            403
          );
          const response = await fetch(base + path, { headers: { Cookie: adminCookie } });
          assert.equal(response.status, 200);
          assert.match(response.headers.get('content-type'), /spreadsheetml.sheet/);
          assert.match(
            response.headers.get('content-disposition'),
            /ocorrencias-transporte-\d{4}-\d{2}-\d{2}\.xlsx/
          );
          assert.match(response.headers.get('cache-control'), /no-store/);
          const book = new ExcelJS.Workbook();
          await book.xlsx.load(Buffer.from(await response.arrayBuffer()));
          const sheet = book.getWorksheet('Ocorrências');
          assert.equal(sheet.rowCount - 6, 25);
          assert.ok(sheet.getCell('A4').value.includes('HIST_100%'));
        }
      );
      await t.test(
        'Excel reutiliza período e filtros combinados e inclui todos os passageiros',
        async () => {
          const query = new URLSearchParams({
            data_inicial: '2026-09-01',
            data_final: '2026-09-10',
            status: 'completed',
            condutor_id: String(driverA.id),
            veiculo_id: '1',
            setor_id: '1',
            busca: 'HIST_100%',
          });
          const response = await fetch(base + '/api/ocorrencias/exportar-excel?' + query, {
            headers: { Cookie: adminCookie },
          });
          assert.equal(response.status, 200);
          const book = new ExcelJS.Workbook();
          await book.xlsx.load(Buffer.from(await response.arrayBuffer()));
          assert.equal(book.getWorksheet('Ocorrências').rowCount - 6, 10);
          const porPassageiro = await fetch(
            base +
              '/api/ocorrencias/exportar-excel?' +
              new URLSearchParams({
                busca: 'Maria Teste',
                condutor_id: String(driverA.id),
                status: 'completed',
              }),
            { headers: { Cookie: adminCookie } }
          );
          const passageirosBook = new ExcelJS.Workbook();
          await passageirosBook.xlsx.load(Buffer.from(await porPassageiro.arrayBuffer()));
          const sheet = passageirosBook.getWorksheet('Ocorrências');
          assert.equal(sheet.rowCount - 6, 1);
          assert.ok(sheet.getCell('F7').value.includes('Maria Teste'));
          assert.ok(sheet.getCell('F7').value.includes('João Teste'));
          assert.equal(
            (
              await fetch(
                base +
                  '/api/ocorrencias/exportar-excel?data_inicial=2026-10-30&data_final=2026-10-29',
                { headers: { Cookie: adminCookie } }
              )
            ).status,
            422
          );
        }
      );
      await t.test('Excel de resultado vazio é válido e pendências ficam em branco', async () => {
        const response = await fetch(
          base + '/api/ocorrencias/exportar-excel?busca=nenhuma-viagem-com-esse-texto',
          { headers: { Cookie: adminCookie } }
        );
        assert.equal(response.status, 200);
        const book = new ExcelJS.Workbook();
        await book.xlsx.load(Buffer.from(await response.arrayBuffer()));
        assert.equal(book.getWorksheet('Ocorrências').rowCount, 6);
        const aberto = await fetch(
          base +
            '/api/ocorrencias/exportar-excel?' +
            new URLSearchParams({ status: 'in_progress', condutor_id: String(driverA.id) }),
          { headers: { Cookie: adminCookie } }
        );
        const pendingBook = new ExcelJS.Workbook();
        await pendingBook.xlsx.load(Buffer.from(await aberto.arrayBuffer()));
        const sheet = pendingBook.getWorksheet('Ocorrências');
        assert.equal(sheet.rowCount - 6, 1);
        for (const col of ['I7', 'J7', 'L7', 'M7']) assert.equal(sheet.getCell(col).value, null);
      });
      await t.test('PDF e impressão respeitam autorização, conteúdo e cache privado', async () => {
        const path = '/api/ocorrencias/' + viagemId;
        assert.equal((await fetch(base + path + '/pdf')).status, 401);
        assert.equal(
          (await fetch(base + path + '/pdf', { headers: { Cookie: driverB.cookie } })).status,
          404
        );
        assert.equal(
          (await fetch(base + path + '/impressao', { headers: { Cookie: driverB.cookie } })).status,
          404
        );
        const response = await fetch(base + path + '/pdf', { headers: { Cookie: driverA.cookie } });
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type'), /application\/pdf/);
        assert.match(
          response.headers.get('content-disposition'),
          /attachment; filename="OC-\d+\.pdf"/
        );
        assert.match(response.headers.get('cache-control'), /no-store/);
        assert.equal(
          Buffer.from(await response.arrayBuffer())
            .subarray(0, 5)
            .toString(),
          '%PDF-'
        );
        const adminPdf = await fetch(base + path + '/pdf', { headers: { Cookie: adminCookie } });
        assert.equal(adminPdf.status, 200);
        const html = await fetch(base + path + '/impressao', {
          headers: { Cookie: driverA.cookie },
        });
        assert.equal(html.status, 200);
        const text = await html.text();
        assert.ok(text.includes('OCORRÊNCIAS DIÁRIAS'));
        assert.ok(text.includes('data:image/png;base64,'));
        assert.ok(text.includes('Concluída'));
        const parcial = await request('/ocorrencias?status=in_progress', {
          cookie: driverA.cookie,
        });
        const partialHtml = await fetch(
          base + '/api/ocorrencias/' + parcial.data.em_andamento.id + '/impressao',
          { headers: { Cookie: driverA.cookie } }
        );
        const partial = await partialHtml.text();
        assert.ok(partial.includes('documento parcial'));
        assert.ok(partial.includes('Assinatura do condutor pendente'));
        const viewerDoc = await fetch(base + path + '/pdf', {
          headers: { Cookie: 'frotas_sessao=' + gerarToken(viewer.insertId) },
        });
        assert.equal(viewerDoc.status, 200);
      });
      // Fixtures concluídas diretamente no banco isolado para liberar a frota para o teste de tela.
      await pool.query(
        "UPDATE ocorrencias SET chegada_em=DATE_ADD(saida_em, INTERVAL 1 HOUR), km_final=km_inicial+10, assinatura_condutor=X'01', assinado_por=condutor_id, assinado_em=DATE_ADD(saida_em, INTERVAL 1 HOUR), status='completed' WHERE status='in_progress' AND condutor_id IN (?, ?, ?)",
        driversViagem.map((d) => d.id)
      );
      await t.test(
        'gestão de usuários: permissão, busca, ativação e sessão atualizada',
        async () => {
          for (const cookie of [driverA.cookie, 'frotas_sessao=' + gerarToken(viewer.insertId)])
            assert.equal((await request('/usuarios', { cookie })).response.status, 403);
          const list = await request('/usuarios?busca=Viewer', { cookie: adminCookie });
          assert.equal(list.response.status, 200);
          assert.equal(list.data.total, 1);
          assert.equal(JSON.stringify(list.data).includes('senha_hash'), false);
          const path = '/usuarios/' + viewer.insertId + '/acesso';
          assert.equal(
            (
              await request(path, {
                method: 'PUT',
                cookie: adminCookie,
                data: { perfil: 'driver', status: 'active' },
              })
            ).response.status,
            200
          );
          assert.equal(
            (
              await request('/auth/sessao', {
                cookie: 'frotas_sessao=' + gerarToken(viewer.insertId),
              })
            ).data.usuario.perfil,
            'driver'
          );
          assert.equal(
            (
              await request(path, {
                method: 'PUT',
                cookie: adminCookie,
                data: { perfil: 'viewer', status: 'inactive' },
              })
            ).response.status,
            200
          );
          assert.equal(
            (
              await request('/auth/sessao', {
                cookie: 'frotas_sessao=' + gerarToken(viewer.insertId),
              })
            ).response.status,
            401
          );
          assert.equal(
            (
              await request(path, {
                method: 'PUT',
                cookie: adminCookie,
                data: { perfil: 'viewer', status: 'active' },
              })
            ).response.status,
            200
          );
          assert.equal(
            (
              await request('/usuarios/' + admin.insertId + '/acesso', {
                method: 'PUT',
                cookie: adminCookie,
                data: { perfil: 'viewer', status: 'active' },
              })
            ).response.status,
            409
          );
          const [[audit]] = await pool.execute(
            "SELECT COUNT(*) AS n FROM auditoria WHERE acao='alterar_acesso' AND entidade_id=?",
            [viewer.insertId]
          );
          assert.equal(Number(audit.n), 3);
        }
      );
      await t.test(
        'administradores concorrentes não removem o último acesso administrativo',
        async () => {
          const [extra] = await pool.execute(
            "INSERT INTO usuarios(nome,email,senha_hash,perfil,status) VALUES ('Outro Admin','admin2@example.invalid',?,'admin','active')",
            [hash]
          );
          const resultados = await Promise.all([
            request('/usuarios/' + extra.insertId + '/acesso', {
              method: 'PUT',
              cookie: adminCookie,
              data: { perfil: 'viewer', status: 'inactive' },
            }),
            request('/usuarios/' + admin.insertId + '/acesso', {
              method: 'PUT',
              cookie: 'frotas_sessao=' + gerarToken(extra.insertId),
              data: { perfil: 'viewer', status: 'inactive' },
            }),
          ]);
          assert.equal(resultados.filter((r) => r.response.status === 200).length, 1);
          const [[ativos]] = await pool.query(
            "SELECT COUNT(*) AS total FROM usuarios WHERE perfil='admin' AND status='active'"
          );
          assert.equal(Number(ativos.total), 1);
          await pool.execute("UPDATE usuarios SET perfil='admin',status='active' WHERE id=?", [
            admin.insertId,
          ]);
          await pool.execute("UPDATE usuarios SET perfil='viewer',status='inactive' WHERE id=?", [
            extra.insertId,
          ]);
        }
      );
      await t.test(
        'correção exige justificativa, administrador e assinatura válida sem alterar o original',
        async () => {
          const original = (await request('/ocorrencias/' + viagemId, { cookie: adminCookie })).data
            .ocorrencia;
          const path = '/ocorrencias/' + viagemId + '/correcoes';
          const body = {
            ...inicio,
            chegada_em: '2026-10-30T01:00',
            km_final: 129.5,
            itinerario: 'Rota corrigida para conferência',
            justificativa: 'Ajuste da leitura do hodômetro e do itinerário.',
            revisao: original.revisao,
            assinatura,
          };
          assert.equal(
            (await request(path, { method: 'POST', cookie: driverA.cookie, data: body })).response
              .status,
            403
          );
          for (const delta of [
            { justificativa: '' },
            { assinatura: '' },
            { km_final: 1 },
            { condutor_id: driverB.id },
            { revisao: 1 },
          ])
            assert.ok(
              [409, 422].includes(
                (
                  await request(path, {
                    method: 'POST',
                    cookie: adminCookie,
                    data: { ...body, ...delta },
                  })
                ).response.status
              )
            );
          const results = await Promise.all(
            [1, 2].map(() => request(path, { method: 'POST', cookie: adminCookie, data: body }))
          );
          assert.deepEqual(results.map((r) => r.response.status).sort(), [201, 409]);
          const atual = (await request('/ocorrencias/' + viagemId, { cookie: driverA.cookie })).data
            .ocorrencia;
          assert.deepEqual(atual, original);
          const historico = await request(path, { cookie: driverA.cookie });
          const proposta = historico.data.correcoes[0];
          assert.equal(proposta.status, 'pending');
          assert.equal(proposta.dados_anteriores.assinatura_condutor, undefined);
          assert.equal(proposta.dados_propostos.km_final, 129.5);
          assert.equal((await request(path, { cookie: driverB.cookie })).response.status, 404);
          const pendentes = await request('/ocorrencias/correcoes-pendentes', {
            cookie: driverA.cookie,
          });
          assert.equal(pendentes.data.correcoes.length, 1);
          assert.equal(
            (await request('/ocorrencias/correcoes-pendentes', { cookie: driverB.cookie })).data
              .correcoes.length,
            0
          );
          assert.equal(
            (
              await request('/usuarios/' + driverA.id + '/acesso', {
                method: 'PUT',
                cookie: adminCookie,
                data: { perfil: 'viewer', status: 'active' },
              })
            ).response.status,
            409
          );
          const confirmPath = path + '/' + proposta.id + '/confirmar';
          const confirm = {
            assinatura,
            revisao: proposta.revisao_base,
            conteudo_sha256: proposta.conteudo_sha256,
          };
          assert.equal(
            (await request(confirmPath, { method: 'POST', cookie: adminCookie, data: confirm }))
              .response.status,
            404
          );
          assert.equal(
            (await request(confirmPath, { method: 'POST', cookie: driverB.cookie, data: confirm }))
              .response.status,
            404
          );
          assert.equal(
            (
              await request(confirmPath, {
                method: 'POST',
                cookie: driverA.cookie,
                data: { ...confirm, conteudo_sha256: '0'.repeat(64) },
              })
            ).response.status,
            409
          );
          const applied = await Promise.all(
            [1, 2].map(() =>
              request(confirmPath, { method: 'POST', cookie: driverA.cookie, data: confirm })
            )
          );
          assert.deepEqual(applied.map((r) => r.response.status).sort(), [200, 409]);
          const corrigida = (await request('/ocorrencias/' + viagemId, { cookie: driverA.cookie }))
            .data.ocorrencia;
          assert.equal(corrigida.revisao, original.revisao + 1);
          assert.equal(corrigida.km_final, 129.5);
          assert.equal(corrigida.distancia_km, 29);
          assert.equal(corrigida.itinerario, body.itinerario);
          const [[saved]] = await pool.execute(
            'SELECT dados_anteriores,status,assinatura_administrador,assinatura_condutor FROM correcoes_ocorrencia WHERE id=?',
            [proposta.id]
          );
          assert.equal(saved.status, 'applied');
          assert.ok(saved.assinatura_administrador.length);
          assert.ok(saved.assinatura_condutor.length);
          const before =
            typeof saved.dados_anteriores === 'string'
              ? JSON.parse(saved.dados_anteriores)
              : saved.dados_anteriores;
          assert.equal(before.km_final, original.km_final);
          assert.ok(before.assinatura_condutor);
          for (const parte of ['administrador', 'condutor', 'anterior']) {
            const url = base + '/api' + path + '/' + proposta.id + '/assinatura/' + parte;
            assert.equal((await fetch(url, { headers: { Cookie: driverA.cookie } })).status, 200);
            assert.equal((await fetch(url, { headers: { Cookie: driverB.cookie } })).status, 404);
          }
          const html = await fetch(base + '/api/ocorrencias/' + viagemId + '/impressao', {
            headers: { Cookie: adminCookie },
          });
          assert.match(await html.text(), /Correção administrativa/);
          const pdf = await fetch(base + '/api/ocorrencias/' + viagemId + '/pdf', {
            headers: { Cookie: adminCookie },
          });
          assert.equal(pdf.status, 200);
          const [[audits]] = await pool.execute(
            "SELECT COUNT(*) AS n FROM auditoria WHERE correcao_id=? AND acao IN ('propor_correcao','aplicar_correcao')",
            [proposta.id]
          );
          assert.equal(Number(audits.n), 2);
        }
      );
      await t.test('dashboard: contagens, fuso, recentes e isolamento por perfil', async () => {
        assert.equal((await request('/dashboard')).response.status, 401);
        for (const [id, perfil] of [
          [admin.insertId, 'admin'],
          [viewer.insertId, 'viewer'],
          [driverA.id, 'driver'],
        ]) {
          const result = await request('/dashboard', { cookie: 'frotas_sessao=' + gerarToken(id) });
          assert.equal(result.response.status, 200);
          assert.match(result.response.headers.get('cache-control'), /no-store/);
          const filtro = perfil === 'driver' ? ' WHERE condutor_id=?' : '';
          const params = perfil === 'driver' ? [id] : [];
          const [[counts]] = await pool.execute(
            "SELECT COUNT(CASE WHEN status='in_progress' THEN 1 END) AS andamento,COUNT(CASE WHEN status='completed' THEN 1 END) AS concluidas FROM ocorrencias" +
              filtro,
            params
          );
          assert.equal(result.data.indicadores.em_andamento, Number(counts.andamento));
          assert.equal(result.data.indicadores.concluidas, Number(counts.concluidas));
          const inicio = new Date(result.data.data + 'T00:00:00-03:00');
          const fim = new Date(inicio.getTime() + 86400000);
          const [[today]] = await pool.execute(
            'SELECT COUNT(*) AS total FROM ocorrencias WHERE saida_em>=? AND saida_em<?' +
              (perfil === 'driver' ? ' AND condutor_id=?' : ''),
            [inicio, fim, ...params]
          );
          assert.equal(result.data.indicadores.hoje, Number(today.total));
          const [[vehicles]] = await pool.query(
            'SELECT COUNT(*) AS total FROM veiculos WHERE ativo=1 AND excluido_em IS NULL'
          );
          assert.equal(result.data.indicadores.veiculos_ativos, Number(vehicles.total));
          const [recentes] = await pool.execute(
            'SELECT id FROM ocorrencias' + filtro + ' ORDER BY saida_em DESC,id DESC LIMIT 5',
            params
          );
          assert.deepEqual(
            result.data.recentes.map((x) => x.id),
            recentes.map((x) => x.id)
          );
        }
      });
      if (process.env.BROWSER_TEST === '1')
        await t.test('interface desktop/celular e aprovação no Chrome', async () => {
          const { chromium, expect } = await import('@playwright/test');
          const { mkdir } = await import('node:fs/promises');
          await mkdir('test-results', { recursive: true });
          const browser = await chromium.launch({ channel: 'chrome', headless: true });
          try {
            const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', (error) => errors.push(error.message));
            async function abrirMenu() {
              await expect(page.locator('#nav-inicio')).toBeAttached();
              const button = page.getByRole('button', {
                name: 'Abrir menu de navegação',
                exact: true,
              });
              if (await button.isVisible()) await button.click();
            }
            async function navegar(chave) {
              await abrirMenu();
              await page.locator('#nav-' + chave).click();
            }

            await page.goto(base);
            await expect(
              page.getByRole('heading', { name: 'Bom ter você por aqui.' })
            ).toBeVisible();
            await page.screenshot({ path: 'test-results/login-desktop.png', fullPage: true });
            await page.getByRole('button', { name: 'Solicitar cadastro', exact: true }).click();
            await page.setViewportSize({ width: 390, height: 844 });
            await expect(
              page.getByRole('heading', { name: 'Tudo começa por aqui.' })
            ).toBeVisible();
            assert.equal(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
              true
            );
            await page.screenshot({ path: 'test-results/cadastro-mobile.png', fullPage: true });
            await page.locator('#cadastro-nome').fill('Condutor Navegador');
            await page.locator('#cadastro-email').fill('browser@example.invalid');
            await page.locator('#cadastro-senha').fill(senha);
            await page.locator('#cadastro-confirmacao').fill(senha);
            await page.getByRole('button', { name: 'Solicitar meu acesso' }).click();
            await expect(
              page.getByRole('heading', { name: 'Falta só a aprovação.' })
            ).toBeVisible();
            await page.getByRole('button', { name: 'Voltar para entrar' }).click();
            await page.locator('#login-email').fill('browser@example.invalid');
            await page.locator('#login-senha').fill(senha);
            await page.getByRole('button', { name: 'Entrar na conta' }).click();
            await expect(page.locator('#feedback')).toContainText('aguarda aprovação');
            await page.locator('#login-email').fill('admin@example.invalid');
            await page.getByRole('button', { name: 'Entrar na conta' }).click();
            await page.waitForURL('**/painel.html');
            await navegar('aprovacoes');
            await expect(
              page.getByRole('button', { name: 'Aprovar acesso de Condutor Navegador' })
            ).toBeVisible();
            await page.setViewportSize({ width: 1440, height: 1000 });
            await page.screenshot({ path: 'test-results/aprovacao-desktop.png', fullPage: true });
            await page
              .getByRole('button', { name: 'Aprovar acesso de Condutor Navegador' })
              .click();
            await expect(page.locator('#lista-status')).toContainText(
              'Nenhuma solicitação pendente'
            );
            await navegar('viagens');
            await expect(page.locator('#lista-view')).toBeVisible();
            await page.locator('#historico-busca').fill('HIST_100%');
            await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
            await expect(page.locator('#lista-info')).toContainText('de 25 viagens');
            await page.getByRole('button', { name: 'Próxima →', exact: true }).click();
            await expect(page.locator('#historico-pagina')).toHaveText('Página 2 de 2');
            await expect(page.locator('#exportar-excel')).toBeEnabled();
            await expect(page.locator('#excel-info')).toContainText('25 viagem');
            await page.locator('#historico-busca').fill('filtro ainda não aplicado');
            await expect(page.locator('#exportar-excel')).toBeDisabled();
            await expect(page.locator('#excel-info')).toContainText('filtros alterados');
            await page.locator('#historico-busca').fill('HIST_100%');
            await expect(page.locator('#exportar-excel')).toBeEnabled();
            const excelDownloadPromise = page.waitForEvent('download');
            await page.getByRole('button', { name: 'Exportar Excel', exact: true }).click();
            const excelDownload = await excelDownloadPromise;
            assert.match(excelDownload.suggestedFilename(), /\.xlsx$/);
            await excelDownload.saveAs('test-results/exportacao-filtrada.xlsx');
            const excelBook = new ExcelJS.Workbook();
            await excelBook.xlsx.readFile('test-results/exportacao-filtrada.xlsx');
            assert.equal(excelBook.getWorksheet('Ocorrências').rowCount - 6, 25);
            await expect(page.locator('#feedback')).toContainText('todos os resultados filtrados');
            await page.screenshot({ path: 'test-results/historico-desktop.png', fullPage: true });
            const historicoURL = page.url();
            await page.locator('#historico-tabela a').first().click();
            await expect(page.locator('#detalhe-view')).toBeVisible();
            await page.locator('#voltar-registros').click();
            await page.waitForURL(historicoURL);
            await expect(page.locator('#historico-busca')).toHaveValue('HIST_100%');
            await expect(page.locator('#historico-pagina')).toHaveText('Página 2 de 2');
            await page.reload();
            await expect(page.locator('#historico-pagina')).toHaveText('Página 2 de 2');
            await page.locator('#historico-busca').fill('nenhum-registro-com-este-texto');
            await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
            await expect(page.locator('#lista-info')).toContainText('Nenhuma viagem encontrada');
            await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
            await expect(page.locator('#historico-busca')).toHaveValue('');
            await expect(page.locator('#historico-pagina')).toContainText('Página 1 de');
            await navegar('veiculos');
            await expect(page.locator('#nav-veiculos')).toHaveAttribute('aria-current', 'page');
            await page.reload();
            await expect(page.locator('#veiculos-panel')).toBeVisible();
            await expect(page.locator('#status-veiculos')).toContainText('cadastros encontrados');
            await page.getByRole('button', { name: 'Novo veículo', exact: true }).click();
            await page.locator('#veiculo-marca').fill('Teste Navegador');
            await page.locator('#veiculo-modelo').fill('Carro Navegador');
            await page.locator('#veiculo-placa').fill('UIA1B23');
            await page.getByRole('button', { name: 'Salvar veículo', exact: true }).click();
            await expect(page.locator('#dialog-veiculo')).not.toBeVisible();
            await page.locator('#busca-veiculos').fill('UIA1B23');
            await expect(page.locator('#lista-veiculos tr')).toHaveCount(1);
            await page
              .getByRole('button', { name: 'Editar Carro Navegador · UIA1B23', exact: true })
              .click();
            await page.locator('#veiculo-modelo').fill('Carro Editado');
            await page.getByRole('button', { name: 'Salvar veículo', exact: true }).click();
            await expect(page.locator('#lista-veiculos')).toContainText('Carro Editado');
            await page
              .getByRole('button', { name: 'Desativar Carro Editado · UIA1B23', exact: true })
              .click();
            await expect(page.locator('#lista-veiculos')).toContainText('Inativo');
            await page.locator('#filtro-veiculos').selectOption('ativos');
            await expect(page.locator('#lista-veiculos tr')).toHaveCount(0);
            await page.locator('#filtro-veiculos').selectOption('inativos');
            await expect(page.locator('#lista-veiculos tr')).toHaveCount(1);
            await page.screenshot({ path: 'test-results/veiculos-desktop.png', fullPage: true });
            await page
              .getByRole('button', { name: 'Ativar Carro Editado · UIA1B23', exact: true })
              .click();
            await page.locator('#filtro-veiculos').selectOption('todos');
            await expect(page.locator('#lista-veiculos tr')).toHaveCount(1);
            page.once('dialog', (dialog) => dialog.accept());
            await page
              .getByRole('button', { name: 'Arquivar Carro Editado · UIA1B23', exact: true })
              .click();
            await expect(page.locator('#lista-veiculos tr')).toHaveCount(0);
            await navegar('setores');
            await page.getByRole('button', { name: 'Novo setor', exact: true }).click();
            await page.locator('#setor-nome').fill('Setor Navegador');
            await page.getByRole('button', { name: 'Salvar setor', exact: true }).click();
            await expect(page.locator('#dialog-setor')).not.toBeVisible();
            await page.locator('#busca-setores').fill('Navegador');
            await expect(page.locator('#lista-setores tr')).toHaveCount(1);
            await page.setViewportSize({ width: 390, height: 844 });
            assert.equal(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
              true
            );
            await page.screenshot({ path: 'test-results/setores-mobile.png', fullPage: true });
            await page.getByRole('button', { name: 'Editar Setor Navegador', exact: true }).click();
            await page.locator('#setor-nome').fill('Setor Navegador Editado');
            await page.getByRole('button', { name: 'Salvar setor', exact: true }).click();
            await expect(page.locator('#lista-setores')).toContainText('Setor Navegador Editado');
            await page
              .getByRole('button', { name: 'Desativar Setor Navegador Editado', exact: true })
              .click();
            await expect(page.locator('#lista-setores')).toContainText('Inativo');
            await abrirMenu();
            await page.getByRole('button', { name: 'Sair da conta' }).click();
            await page.waitForURL(base + '/');
            await page.locator('#login-email').fill('browser@example.invalid');
            await page.locator('#login-senha').fill(senha);
            await page.getByRole('button', { name: 'Entrar na conta' }).click();
            await page.waitForURL('**/painel.html');
            await expect(
              page.getByRole('heading', { name: 'O que você deseja fazer?' })
            ).toBeVisible();
            await expect(page.locator('#dashboard-dados')).toBeVisible();
            await expect(page.locator('#indicador-hoje')).toHaveText('0');
            await expect(page.locator('#recentes-vazio')).toBeVisible();
            await page.getByRole('button', { name: 'Atualizar resumo', exact: true }).click();
            await expect(page.locator('#dashboard-status')).toContainText('Atualizado em');
            assert.equal(await page.locator('#nav-veiculos').count(), 0);
            assert.equal(await page.locator('#nav-aprovacoes').count(), 0);
            await navegar('viagens');
            await page.waitForURL('**/ocorrencias.html');
            await expect(
              page.getByRole('heading', { name: 'Minhas viagens', exact: true })
            ).toBeVisible();
            await page.locator('#nova-viagem').click();
            await expect(page.locator('#campos-viagem')).toBeEnabled();
            await page.locator('#viagem-veiculo').selectOption('1');
            await page.locator('#viagem-setor').selectOption('1');
            await page.locator('#viagem-saida').fill('2026-10-29T23:30');
            await page.locator('#viagem-km').fill('52381.5');
            await page.locator('#viagem-itinerario').fill('Sede → cliente → sede');
            await page.locator('#viagem-passageiros').fill('Maria Teste\nJoão Teste');
            assert.equal(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
              true
            );
            await page.screenshot({
              path: 'test-results/nova-ocorrencia-mobile.png',
              fullPage: true,
            });
            await page.getByRole('button', { name: 'Registrar saída', exact: true }).click();
            await expect(page.locator('#detalhe-view')).toBeVisible();
            await expect(page.locator('#feedback')).toContainText('Viagem iniciada com sucesso');
            await expect(page.locator('#detalhe-passageiros')).toContainText('Maria Teste');
            await expect(page.locator('#detalhe-dados')).toContainText('29/10/2026');
            const detalheUrl = page.url();
            await page.reload();
            await expect(page.locator('#detalhe-view')).toBeVisible();
            assert.equal(page.url(), detalheUrl);
            await page.setViewportSize({ width: 1440, height: 1000 });
            await page.screenshot({
              path: 'test-results/ocorrencia-detalhe-desktop.png',
              fullPage: true,
            });
            await page.goto(base + '/ocorrencias.html?nova=1');
            await expect(page.locator('#feedback')).toContainText('Conclua a viagem atual');
            await expect(page.locator('#nova-view')).not.toBeVisible();
            assert.ok(page.url().includes('?id='));
            await page.setViewportSize({ width: 390, height: 844 });
            await page.locator('#chegada-data').fill('2026-10-30T01:00');
            await page.locator('#chegada-km').fill('52380');
            assert.equal(
              await page.locator('#chegada-km').evaluate((el) => el.checkValidity()),
              false
            );
            await page.locator('#chegada-km').fill('52406.5');
            await expect(page.locator('#distancia-prevista')).toHaveText('25 km');
            await page
              .getByRole('button', { name: 'Registrar chegada e continuar', exact: true })
              .click();
            await expect(page.locator('#assinatura-etapa')).toBeVisible();
            await expect(page.locator('#confirmar-assinatura')).toBeDisabled();
            await page.reload();
            await expect(page.locator('#assinatura-etapa')).toBeVisible();
            await expect(page.locator('#chegada-km')).toHaveValue('52406.5');
            await page.locator('#assinatura-canvas').scrollIntoViewIfNeeded();
            const canvasBox = await page.locator('#assinatura-canvas').boundingBox();
            await page.mouse.move(canvasBox.x + 25, canvasBox.y + 90);
            await page.mouse.down();
            for (let i = 1; i <= 30; i++)
              await page.mouse.move(
                canvasBox.x + 25 + i * 7,
                canvasBox.y + 90 + Math.sin(i / 2) * 22
              );
            await page.mouse.up();
            await expect(page.locator('#confirmar-assinatura')).toBeEnabled();
            await page.getByRole('button', { name: 'Limpar assinatura', exact: true }).click();
            await expect(page.locator('#confirmar-assinatura')).toBeDisabled();
            await page.mouse.move(canvasBox.x + 25, canvasBox.y + 80);
            await page.mouse.down();
            for (let i = 1; i <= 30; i++)
              await page.mouse.move(
                canvasBox.x + 25 + i * 7,
                canvasBox.y + 80 + Math.sin(i / 2) * 25
              );
            await page.mouse.up();
            await expect(page.locator('#confirmar-assinatura')).toBeEnabled();
            await page.screenshot({ path: 'test-results/assinatura-mobile.png', fullPage: true });
            await page
              .getByRole('button', { name: 'Assinar e concluir viagem', exact: true })
              .click();
            await expect(page.locator('#detalhe-status')).toHaveText('Concluída');
            await expect(page.locator('#feedback')).toContainText('Viagem concluída');
            await expect(page.locator('#assinatura-imagem')).toBeVisible();
            await expect
              .poll(() =>
                page
                  .locator('#assinatura-imagem')
                  .evaluate((el) => el.complete && el.naturalWidth > 0)
              )
              .toBe(true);
            await page.reload();
            await expect(page.locator('#detalhe-status')).toHaveText('Concluída');
            await expect(page.locator('#finalizacao-section')).not.toBeVisible();
            await page.setViewportSize({ width: 1440, height: 1000 });
            await page.screenshot({
              path: 'test-results/viagem-concluida-desktop.png',
              fullPage: true,
            });
            await expect(page.locator('#nova-viagem')).toBeVisible();
            await expect(page.locator('#sidebar')).toBeVisible();
            await expect(page.locator('#nav-viagens')).toHaveAttribute('aria-current', 'page');
            await page.screenshot({
              path: 'test-results/menu-lateral-desktop.png',
              fullPage: true,
            });
            await page.setViewportSize({ width: 390, height: 844 });
            await expect(page.locator('#sidebar')).toHaveAttribute('aria-hidden', 'true');
            await abrirMenu();
            await expect(page.locator('#sidebar')).toHaveAttribute('aria-hidden', 'false');
            await expect
              .poll(async () => Math.round((await page.locator('#sidebar').boundingBox()).x))
              .toBe(0);
            await page.screenshot({
              path: 'test-results/menu-lateral-mobile.png',
              fullPage: false,
            });
            await page.locator('#sair').focus();
            await page.keyboard.press('Tab');
            await expect(page.locator('.sidebar .brand')).toBeFocused();
            await page.keyboard.press('Escape');
            await expect(page.locator('#sidebar')).toHaveAttribute('aria-hidden', 'true');
            await expect(page.locator('#abrir-menu')).toBeFocused();
            await navegar('inicio');
            await expect(page.locator('#inicio-panel')).toBeVisible();
            await navegar('viagens');
            await expect(page.locator('#lista-view')).toBeVisible();
            await expect(page.locator('#historico-condutor-group')).toBeHidden();
            await expect(page.locator('#exportar-excel')).toBeHidden();
            await page.locator('#historico-busca').fill('cliente');
            await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
            await expect(page.locator('#lista-info')).toContainText('de 1 viagem.');
            await expect(page.locator('#viagens-lista .trip-card')).toHaveCount(1);
            await page.screenshot({ path: 'test-results/historico-mobile.png', fullPage: true });
            assert.equal(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
              true
            );
            await page.locator('#viagens-lista .trip-card').click();
            await expect(page.locator('#detalhe-view')).toBeVisible();
            const downloadPromise = page.waitForEvent('download');
            await page.getByRole('button', { name: 'Gerar PDF', exact: true }).click();
            const download = await downloadPromise;
            assert.match(download.suggestedFilename(), /^OC-\d+\.pdf$/);
            await download.saveAs('test-results/pdf-baixado.pdf');
            await expect(page.locator('#feedback')).toContainText('PDF gerado com sucesso');
            await context.addInitScript(() => {
              window.print = () => {
                document.documentElement.dataset.impressaoAberta = 'true';
              };
            });
            const popupPromise = page.waitForEvent('popup');
            await page.getByRole('link', { name: 'Imprimir', exact: true }).click();
            const popup = await popupPromise;
            await popup.waitForLoadState('load');
            await expect(popup.locator('#documento-status')).toHaveText(
              'Documento A4 pronto para imprimir.'
            );
            await expect(popup.locator('html')).toHaveAttribute('data-impressao-aberta', 'true');
            await popup.setViewportSize({ width: 1100, height: 1100 });
            await popup.screenshot({ path: 'test-results/impressao-preview.png', fullPage: true });
            await popup.emulateMedia({ media: 'print' });
            await popup.pdf({
              path: 'test-results/impressao-browser.pdf',
              format: 'A4',
              printBackground: true,
              preferCSSPageSize: true,
            });
            await expect(popup.locator('.print-toolbar')).not.toBeVisible();
            await popup.close();
            // Exercita gestão de acesso e correção com duas sessões reais.
            const viagemBrowserId = new URL(page.url()).searchParams.get('id');
            async function entrarComo(email) {
              await abrirMenu();
              await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
              await page.waitForURL(base + '/');
              await page.locator('#login-email').fill(email);
              await page.locator('#login-senha').fill(senha);
              await page.getByRole('button', { name: 'Entrar na conta', exact: true }).click();
              await page.waitForURL('**/painel.html');
            }
            async function desenhar(selector) {
              await page.locator(selector).scrollIntoViewIfNeeded();
              const b = await page.locator(selector).boundingBox();
              await page.mouse.move(b.x + 20, b.y + 80);
              await page.mouse.down();
              for (let i = 1; i < 30; i++)
                await page.mouse.move(b.x + 20 + i * 5, b.y + 80 + Math.sin(i / 2) * 22);
              await page.mouse.up();
            }
            await entrarComo('admin@example.invalid');
            await navegar('usuarios');
            await page.locator('#usuarios-busca').fill('Viewer Teste');
            await page.getByRole('button', { name: 'Buscar usuários', exact: true }).click();
            await page
              .getByRole('button', { name: 'Alterar acesso de Viewer Teste', exact: true })
              .click();
            await page.locator('#usuario-status').selectOption('inactive');
            await page.getByRole('button', { name: 'Confirmar alteração', exact: true }).click();
            await expect(page.locator('#usuarios-lista')).toContainText('Inativo');
            await page
              .getByRole('button', { name: 'Alterar acesso de Viewer Teste', exact: true })
              .click();
            await page.locator('#usuario-status').selectOption('active');
            await page.getByRole('button', { name: 'Confirmar alteração', exact: true }).click();
            await expect(page.locator('#usuarios-lista')).toContainText('Ativo');
            await page.setViewportSize({ width: 1440, height: 1000 });
            await page.screenshot({ path: 'test-results/usuarios-desktop.png', fullPage: true });
            await page.goto(base + '/ocorrencias.html?id=' + viagemBrowserId);
            await page.getByRole('button', { name: 'Corrigir ocorrência', exact: true }).click();
            await expect(page.locator('#correcao-form')).toBeVisible();
            await page.locator('#correcao-km-final').fill('52420');
            await page
              .locator('#correcao-justificativa')
              .fill('Conferência demonstrativa da leitura final.');
            await desenhar('#correcao-admin-canvas');
            await expect(page.locator('#correcao-enviar')).toBeEnabled();
            await page
              .locator('#correcao-justificativa')
              .fill('Conferência demonstrativa da leitura final do hodômetro.');
            await expect(page.locator('#correcao-enviar')).toBeDisabled();
            await desenhar('#correcao-admin-canvas');
            const invalidos = await page.locator('#correcao-form').evaluate((f) =>
              Array.from(f.elements)
                .filter((el) => el.willValidate && !el.validity.valid)
                .map((el) => ({ id: el.id, mensagem: el.validationMessage, valor: el.value }))
            );
            assert.deepEqual(invalidos, []);
            const propostaResponse = page.waitForResponse(
              (r) => r.url().endsWith('/correcoes') && r.request().method() === 'POST'
            );
            await page.locator('#correcao-enviar').click();
            const respostaProposta = await propostaResponse;
            assert.equal(respostaProposta.status(), 201, await respostaProposta.text());
            await expect(page.locator('#correcao-status')).toContainText('aguardando');
            await page.screenshot({ path: 'test-results/correcao-admin.png', fullPage: true });
            await entrarComo('browser@example.invalid');
            await navegar('correcoes');
            await expect(page.locator('#correcoes-lista')).toContainText(
              'Conferência demonstrativa'
            );
            await page.locator('#correcoes-lista a').first().click();
            await expect(page.locator('#correcao-confirmacao')).toBeVisible();
            await expect(page.locator('#correcao-historico')).toContainText('52.420');
            for (const width of [390, 768, 1440]) {
              await page.setViewportSize({ width, height: 1000 });
              assert.equal(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
                true
              );
            }
            await page.setViewportSize({ width: 390, height: 844 });
            await expect
              .poll(async () => {
                const b = await page.locator('#sidebar').boundingBox();
                return b.x + b.width <= 1;
              })
              .toBe(true);
            await page.screenshot({ path: 'test-results/correcao-mobile.png', fullPage: true });
            await desenhar('#correcao-condutor-canvas');
            await expect(page.locator('#correcao-confirmar')).toBeDisabled();
            await page.locator('#correcao-concordo').check();
            await page.locator('#correcao-confirmar').click();
            await expect(page.locator('#feedback')).toContainText('Correção aplicada');
            await expect(page.locator('#detalhe-dados')).toContainText('52.420');
            await expect(page.locator('#correcao-historico')).toContainText('Aplicada');
            await page.locator('.correcao-registro > summary').click();
            await page
              .getByText('Consultar assinatura da versão anterior', { exact: true })
              .click();
            await expect(page.locator('img[alt="Assinatura original preservada"]')).toBeVisible();
            await page.screenshot({
              path: 'test-results/correcao-aplicada-mobile.png',
              fullPage: true,
            });
            assert.deepEqual(errors, []);
          } finally {
            await browser.close();
          }
        });
    } finally {
      await new Promise((resolve) => server.close(resolve));
      await pool.end();
    }
  }
);
