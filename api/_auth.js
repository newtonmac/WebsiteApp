// Shared auth helper for admin API endpoints
// Uses a signed JWT cookie for session management

const crypto = require('crypto');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'paddle2026';
const JWT_SECRET = process.env.JWT_SECRET || 'pp-admin-secret-2026-change-me';
const COOKIE_NAME = 'pp_admin_session';
const SESSION_DURATION = 24 * 60 * 60; // 24 hours in seconds

// Simple JWT implementation (no external deps needed on Vercel)
function createToken(payload, expiresIn) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + expiresIn })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  try {
    const [header, body, signature] = token.split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

// Parse cookies from request
function parseCookies(req) {
  const cookies = {};
  const header = req.headers.cookie || '';
  header.split(';').forEach(c => {
    const [key, ...val] = c.trim().split('=');
    if (key) cookies[key] = val.join('=');
  });
  return cookies;
}

// Check if request has valid admin session
function requireAdmin(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return { valid: false, error: 'Not authenticated' };
  const payload = verifyToken(token);
  if (!payload) return { valid: false, error: 'Session expired' };
  return { valid: true, user: payload };
}

// Login: validate password and return Set-Cookie header value
function login(password) {
  if (password !== ADMIN_PASSWORD) return null;
  const token = createToken({ role: 'admin' }, SESSION_DURATION);
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${SESSION_DURATION}`;
}

// Logout: return Set-Cookie header that clears the cookie
function logout() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;
}

module.exports = { requireAdmin, login, logout, ADMIN_PASSWORD };
