import { ErroHttp } from './erroHttp.js';
export function validarAcesso(body) {
  if (
    !body ||
    Array.isArray(body) ||
    Object.keys(body).some((k) => !['perfil', 'status'].includes(k)) ||
    !['driver', 'viewer', 'admin'].includes(body.perfil) ||
    !['active', 'inactive'].includes(body.status)
  )
    throw new ErroHttp(422, 'Selecione um perfil e um status válidos.');
  return { perfil: body.perfil, status: body.status };
}
export function validarBuscaUsuarios(query) {
  if (
    Object.keys(query).some((k) => !['busca', 'perfil', 'status', 'pagina'].includes(k)) ||
    Object.values(query).some((v) => typeof v !== 'string')
  )
    throw new ErroHttp(422, 'Confira os filtros de usuários.');
  const busca = (query.busca || '').trim(),
    perfil = query.perfil || '',
    status = query.status || '',
    pagina = query.pagina || '1';
  if (
    busca.length > 150 ||
    (perfil && !['driver', 'viewer', 'admin'].includes(perfil)) ||
    (status && !['pending', 'active', 'inactive'].includes(status)) ||
    !/^[1-9]\d*$/.test(pagina) ||
    Number(pagina) > 2147483647
  )
    throw new ErroHttp(422, 'Confira os filtros de usuários.');
  return { busca, perfil, status, pagina: Number(pagina) };
}
