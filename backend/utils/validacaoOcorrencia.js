import { Temporal } from '@js-temporal/polyfill';
import { ErroHttp } from './erroHttp.js';
export function codigoOcorrencia(id) {
  return 'OC-' + String(id).padStart(6, '0');
}
export function validarSaida(valor) {
  try {
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor))
      throw new Error();
    const local = Temporal.PlainDateTime.from(valor);
    if (local.year < 1000) throw new Error();
    const instant = local
      .toZonedDateTime('America/Sao_Paulo', { disambiguation: 'reject' })
      .toInstant();
    if (instant.toZonedDateTimeISO('UTC').year > 9999) throw new Error();
    return new Date(instant.epochMilliseconds);
  } catch {
    throw new ErroHttp(422, 'Informe uma data e horário de saída válidos no fuso de Brasília.');
  }
}
export function validarNovaOcorrencia(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new ErroHttp(422, 'Confira os dados da viagem.');
  const campos = ['veiculo_id', 'setor_id', 'saida_em', 'km_inicial', 'itinerario', 'passageiros'];
  if (Object.keys(body).some((key) => !campos.includes(key)))
    throw new ErroHttp(
      422,
      'Envie somente os dados de início da viagem. O condutor é definido pela sessão.'
    );
  for (const key of ['veiculo_id', 'setor_id'])
    if (!Number.isInteger(body[key]) || body[key] < 1 || body[key] > 4294967295)
      throw new ErroHttp(422, 'Selecione um veículo e um setor válidos.');
  const km = body.km_inicial;
  if (
    typeof km !== 'number' ||
    !Number.isFinite(km) ||
    km < 0 ||
    km > 999999999.9 ||
    Math.abs(km * 10 - Math.round(km * 10)) > 0.00001
  )
    throw new ErroHttp(422, 'Informe a quilometragem inicial com até uma casa decimal.');
  if (
    typeof body.itinerario !== 'string' ||
    !body.itinerario.trim() ||
    body.itinerario.trim().length > 2000
  )
    throw new ErroHttp(422, 'Informe o itinerário com até 2.000 caracteres.');
  const passageiros = body.passageiros ?? [];
  if (
    !Array.isArray(passageiros) ||
    passageiros.length > 50 ||
    passageiros.some((nome) => typeof nome !== 'string' || !nome.trim() || nome.trim().length > 150)
  )
    throw new ErroHttp(422, 'Informe até 50 passageiros, com um nome válido por linha.');
  return {
    veiculo_id: body.veiculo_id,
    setor_id: body.setor_id,
    saida_em: validarSaida(body.saida_em),
    km_inicial: km,
    itinerario: body.itinerario.trim(),
    passageiros: passageiros.map((nome) => nome.trim()),
  };
}
