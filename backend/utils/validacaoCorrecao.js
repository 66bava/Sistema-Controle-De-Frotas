import { validarNovaOcorrencia } from './validacaoOcorrencia.js';
import { validarChegada, validarAssinatura } from './validacaoFinalizacao.js';
import { ErroHttp } from './erroHttp.js';
export function validarProposta(body) {
  const permitidos = [
    'veiculo_id',
    'setor_id',
    'saida_em',
    'chegada_em',
    'km_inicial',
    'km_final',
    'itinerario',
    'passageiros',
    'justificativa',
    'assinatura',
    'revisao',
  ];
  if (!body || Array.isArray(body) || Object.keys(body).some((k) => !permitidos.includes(k)))
    throw new ErroHttp(422, 'Confira os dados da correção.');
  if (
    typeof body.justificativa !== 'string' ||
    !body.justificativa.trim() ||
    body.justificativa.trim().length > 2000
  )
    throw new ErroHttp(422, 'Informe a justificativa com até 2.000 caracteres.');
  const dados = validarNovaOcorrencia(
    Object.fromEntries(
      ['veiculo_id', 'setor_id', 'saida_em', 'km_inicial', 'itinerario', 'passageiros'].map((k) => [
        k,
        body[k],
      ])
    )
  );
  Object.assign(dados, validarChegada({ chegada_em: body.chegada_em, km_final: body.km_final }));
  if (dados.chegada_em < dados.saida_em || dados.km_final < dados.km_inicial)
    throw new ErroHttp(
      422,
      'A chegada e o km final não podem ser anteriores à saída e ao km inicial.'
    );
  return {
    dados,
    justificativa: body.justificativa.trim(),
    ...validarAssinatura({ assinatura: body.assinatura, revisao: body.revisao }),
  };
}
export function validarConfirmacao(body) {
  if (
    !body ||
    Array.isArray(body) ||
    Object.keys(body).some((k) => !['assinatura', 'revisao', 'conteudo_sha256'].includes(k)) ||
    typeof body.conteudo_sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(body.conteudo_sha256)
  )
    throw new ErroHttp(422, 'Reabra a correção e confira a proposta antes de assinar.');
  return {
    ...validarAssinatura({ assinatura: body.assinatura, revisao: body.revisao }),
    conteudo_sha256: body.conteudo_sha256,
  };
}
