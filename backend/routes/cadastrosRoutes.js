import { Router } from 'express';
import { autenticar, autorizar, protegerOrigem } from '../middlewares/authMiddleware.js';
import { controllers, arquivarVeiculo } from '../controllers/cadastrosController.js';
const router = Router();
router.use(protegerOrigem, autenticar, autorizar('admin'));
for (const tipo of ['veiculos', 'setores']) {
  const controller = controllers(tipo);
  router.get('/' + tipo, controller.listar);
  router.get('/' + tipo + '/:id', controller.buscar);
  router.post('/' + tipo, controller.criar);
  router.put('/' + tipo + '/:id', controller.editar);
}
router.delete('/veiculos/:id', arquivarVeiculo);
export default router;
