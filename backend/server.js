import app from './app.js';
import { validarSegredo } from './services/tokenService.js';
validarSegredo();
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválida.');
app.listen(port, () => console.log('Sistema de frotas disponível em http://localhost:' + port));
