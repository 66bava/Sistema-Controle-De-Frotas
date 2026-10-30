import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as controller from '../controllers/authController.js';
import { autenticar, autorizar, protegerOrigem } from '../middlewares/authMiddleware.js';
const router = Router();
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.use(protegerOrigem);
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { mensagem: 'Muitas tentativas. Aguarde 15 minutos para tentar novamente.' },
});
const limiteCadastro = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { mensagem: 'Limite de cadastros atingido. Tente novamente mais tarde.' },
});
router.post('/auth/cadastro', limiteCadastro, controller.cadastrar);
router.post('/auth/login', limiteLogin, controller.entrar);
router.post('/auth/logout', controller.sair);
router.get('/auth/sessao', autenticar, controller.sessao);
router.get('/usuarios/pendentes', autenticar, autorizar('admin'), controller.pendentes);
router.post('/usuarios/:id/aprovar', autenticar, autorizar('admin'), controller.aprovar);
export default router;
