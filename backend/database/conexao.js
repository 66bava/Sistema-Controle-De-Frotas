import mysql from 'mysql2/promise';
// Pool criado sob demanda: a etapa inicial pode executar sem MySQL configurado.
let pool;
export function obterConexao() {
  if (!process.env.DB_USER || !process.env.DB_NAME) {
    throw new Error('Configure DB_USER e DB_NAME no backend/.env.');
  }
  if (pool) return pool;
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
    timezone: 'Z',
    decimalNumbers: true,
  });
  pool.on('connection', (connection) => {
    connection.query("SET time_zone = '+00:00'", (error) => {
      if (error) connection.destroy();
    });
  });
  return pool;
}
