import { consultar } from '../services/dashboardService.js';
export async function resumo(req, res) {
  res.set('Cache-Control', 'private, no-store').json(await consultar(req.usuario));
}
