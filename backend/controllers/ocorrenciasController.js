import { validarFiltrosHistorico } from '../utils/filtrosHistorico.js';
import * as finalizacao from '../services/finalizacaoService.js';
import { validarChegada, validarAssinatura } from '../utils/validacaoFinalizacao.js';
import * as service from '../services/ocorrenciasService.js';
import { validarNovaOcorrencia } from '../utils/validacaoOcorrencia.js';
import { validarId } from '../utils/validacaoCadastros.js';
export async function opcoes(req, res) {
  res.json(await service.opcoes());
}
export async function listar(req, res) {
  res.json(await service.listar(req.usuario, validarFiltrosHistorico(req.query, req.usuario)));
}
export async function filtros(req, res) {
  res.json(await service.filtrosDisponiveis(req.usuario));
}
export async function buscar(req, res) {
  res.json({ ocorrencia: await service.buscar(validarId(req.params.id), req.usuario) });
}
export async function iniciar(req, res) {
  const dados = validarNovaOcorrencia(req.body);
  const id = await service.iniciar(dados, req.usuario.id);
  res
    .status(201)
    .location('/api/ocorrencias/' + id)
    .json({
      mensagem: 'Viagem iniciada com sucesso.',
      ocorrencia: await service.buscar(id, req.usuario),
    });
}

export async function chegada(req, res) {
  const id = validarId(req.params.id);
  await finalizacao.salvarChegada(id, req.usuario.id, validarChegada(req.body));
  res.json({
    mensagem: 'Chegada salva. Assine para concluir a viagem.',
    ocorrencia: await service.buscar(id, req.usuario),
  });
}
export async function assinar(req, res) {
  const id = validarId(req.params.id);
  await finalizacao.assinarEConcluir(id, req.usuario.id, validarAssinatura(req.body));
  res.json({
    mensagem: 'Viagem concluída com sucesso.',
    ocorrencia: await service.buscar(id, req.usuario),
  });
}
export async function assinatura(req, res) {
  const imagem = await finalizacao.obterAssinatura(validarId(req.params.id), req.usuario);
  res.set('Cache-Control', 'private, no-store').type('png').send(imagem);
}
