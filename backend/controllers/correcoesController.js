import * as service from '../services/correcoesService.js';
import { validarId } from '../utils/validacaoCadastros.js';
import { validarProposta, validarConfirmacao } from '../utils/validacaoCorrecao.js';
export async function pendentes(req, res) {
  res.json({ correcoes: await service.listarPendentes(req.usuario) });
}
export async function historico(req, res) {
  res.json({ correcoes: await service.historico(validarId(req.params.id), req.usuario) });
}
export async function propor(req, res) {
  const id = await service.propor(
    validarId(req.params.id),
    req.usuario.id,
    validarProposta(req.body)
  );
  res.status(201).json({
    id,
    mensagem: 'Correção assinada pelo administrador. Aguarda confirmação do condutor.',
  });
}
export async function confirmar(req, res) {
  await service.confirmar(
    validarId(req.params.id),
    validarId(req.params.correcaoId),
    req.usuario.id,
    validarConfirmacao(req.body)
  );
  res.json({
    mensagem: 'Correção aplicada com as duas assinaturas. A versão anterior foi preservada.',
  });
}
export async function imagem(req, res) {
  res
    .set('Cache-Control', 'private, no-store')
    .type('png')
    .send(
      await service.imagem(
        validarId(req.params.id),
        validarId(req.params.correcaoId),
        req.params.parte,
        req.usuario
      )
    );
}
