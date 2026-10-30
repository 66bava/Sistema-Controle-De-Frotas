import { Router } from 'express';
import { consultarSaude } from '../controllers/saudeController.js';
const router = Router();
router.get('/saude', consultarSaude);
export default router;
