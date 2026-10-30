import { Router } from 'express';
import { autenticar } from '../middlewares/authMiddleware.js';
import { resumo } from '../controllers/dashboardController.js';
const router = Router();
router.get('/', autenticar, resumo);
export default router;
