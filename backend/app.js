import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import corsMiddleware from './middlewares/corsemiddleware.js';
import { rotaNaoEncontrada, tratarErros } from './middlewares/errosMiddleware.js';
import saudeRoutes from './routes/saudeRoutes.js';
import authRoutes from './routes/authRoutes.js';
import cadastrosRoutes from './routes/cadastrosRoutes.js';
import ocorrenciasRoutes from './routes/ocorrenciasRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
const app = express();
const frontend = fileURLToPath(new URL('../frontend/', import.meta.url));
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  res.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
  next();
});
app.use(corsMiddleware);
app.use(express.json({ limit: '384kb' }));
app.use('/api', saudeRoutes, authRoutes);
app.use('/api', (req, res, next) =>
  /^\/(veiculos|setores)(\/|$)/.test(req.path) ? cadastrosRoutes(req, res, next) : next()
);
app.use('/api/ocorrencias', ocorrenciasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.get('/', (req, res) => res.sendFile(path.join(frontend, 'INDEX.HTML')));
app.use(express.static(frontend));
app.use(
  '/fontes',
  express.static(
    fileURLToPath(new URL('./node_modules/@fontsource/inter/files/', import.meta.url)),
    { index: false, maxAge: '1d' }
  )
);
app.use(rotaNaoEncontrada);
app.use(tratarErros);
export default app;
