import * as service from '../services/usuariosService.js';
import { validarId } from '../utils/validacaoCadastros.js';
import { validarAcesso, validarBuscaUsuarios } from '../utils/validacaoUsuarios.js';
export async function listar(req, res) {
  res.json(await service.listar(validarBuscaUsuarios(req.query)));
}
export async function alterar(req, res) {
  await service.alterar(validarId(req.params.id), req.usuario.id, validarAcesso(req.body));
  res.json({ mensagem: 'Acesso atualizado com sucesso.' });
}
