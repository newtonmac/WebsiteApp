// Shared database connection for Vercel serverless functions
const mysql = require('mysql2/promise');

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
  ssl: {
    rejectUnauthorized: false  // Enables SSL without requiring client certs
  },
};

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(DB_CONFIG);
  }
  return pool;
}

async function query(sql, params) {
  const p = getPool();
  const [result] = await p.execute(sql, params);
  return result; // For SELECT: array of rows. For INSERT/UPDATE/DELETE: ResultSetHeader with insertId, affectedRows
}

module.exports = { getPool, query };
