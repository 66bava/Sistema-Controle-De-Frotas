import * as service from '../services/cadastrosService.js';
import { validarCadastroFrota, validarId } from '../utils/validacaoCadastros.js';
export function controllers(tipo) {
  return {
    listar: async (req, res) => res.json({ [tipo]: await service.listar(tipo) }),
    buscar: async (req, res) =>
      res.json({ registro: await service.buscar(tipo, validarId(req.params.id)) }),
    criar: async (req, res) =>
      res.status(201).json({
        registro: await service.salvar(
          tipo,
          null,
          validarCadastroFrota(tipo, req.body),
          req.usuario.id
        ),
        mensagem: 'Cadastro salvo.',
      }),
    editar: async (req, res) =>
      res.json({
        registro: await service.salvar(
          tipo,
          validarId(req.params.id),
          validarCadastroFrota(tipo, req.body),
          req.usuario.id
        ),
        mensagem: 'Cadastro atualizado.',
      }),
  };
}
export async function arquivarVeiculo(req, res) {
  await service.arquivarVeiculo(validarId(req.params.id), req.usuario.id);
  res.json({ mensagem: 'Veículo arquivado. O histórico foi preservado.' });
}
