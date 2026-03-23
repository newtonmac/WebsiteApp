import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host: process.env.DB_HOST || '34.83.208.2',
  port: 3306,
  user: process.env.DB_USER || 'paddle',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'paddlepoint',
  charset: 'utf8mb4',
  connectTimeout: 10000,
  waitForConnections: true,
  connectionLimit: 5,
  ssl: { rejectUnauthorized: false },
};

let pool: mysql.Pool | null = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(DB_CONFIG);
  }
  return pool;
}

export async function query(sql: string, params?: any[]) {
  const p = getPool();
  const [result] = await p.execute(sql, params ?? []);
  return result;
}

export default { getPool, query };
