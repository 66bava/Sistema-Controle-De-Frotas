import { ErroHttp } from './erroHttp.js';
function texto(value, nome, max, opcional = false) {
  if (opcional && (value === undefined || value === null || value === '')) return null;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new ErroHttp(422, 'Confira o campo ' + nome + '.');
  return value.trim();
}
function ativo(value) {
  if (value === undefined) return true;
  if (typeof value !== 'boolean') throw new ErroHttp(422, 'Informe um status válido.');
  return value;
}
export function validarId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > 4294967295)
    throw new ErroHttp(422, 'Identificador inválido.');
  return Number(value);
}
export function validarCadastroFrota(tipo, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new ErroHttp(422, 'Confira os dados enviados.');
  if (tipo === 'setores')
    return { nome: texto(body.nome, 'nome do setor', 100), ativo: ativo(body.ativo) };
  const placa = texto(body.placa, 'placa', 10).toUpperCase().replace(/[-\s]/g, '');
  if (!/^[A-Z]{3}(?:\d{4}|\d[A-Z]\d{2})$/.test(placa))
    throw new ErroHttp(422, 'Informe uma placa válida, como ABC1234 ou ABC1D23.');
  return {
    marca: texto(body.marca, 'marca', 80),
    modelo: texto(body.modelo, 'modelo', 100),
    placa,
    numero_interno: texto(body.numero_interno, 'número interno', 50, true),
    ativo: ativo(body.ativo),
  };
}
