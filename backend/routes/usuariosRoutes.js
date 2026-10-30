import { Router } from 'express';
import { autenticar, autorizar, protegerOrigem } from '../middlewares/authMiddleware.js';
import * as controller from '../controllers/usuariosController.js';
const router = Router();
router.use(protegerOrigem, autenticar, autorizar('admin'));
router.get('/', controller.listar);
router.put('/:id/acesso', controller.alterar);
export default router;
