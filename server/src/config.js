// ═══════════════════════════════════════
// Shared config — single source of truth
// ═══════════════════════════════════════
import crypto from 'crypto';

// JWT secret — fatal in production, stable fallback in dev
const envSecret = process.env.JWT_SECRET;
const isProduction = process.env.NODE_ENV === 'production';
if (!envSecret) {
  if (isProduction) {
    console.error('❌ FATAL: JWT_SECRET não definido no .env em produção!');
    process.exit(1);
  }
  console.warn('⚠️  JWT_SECRET não definido no .env — usando fallback (sessões não persistem entre restarts)');
}
export const JWT_SECRET = envSecret || 'chevla-dev-fallback-' + crypto.randomBytes(16).toString('hex');

// TLS: whether to reject unauthorized certs (default true in production)
export const EMAIL_REJECT_UNAUTHORIZED = process.env.EMAIL_REJECT_UNAUTHORIZED
  ? process.env.EMAIL_REJECT_UNAUTHORIZED === 'true'
  : isProduction;

// Email encryption key — derived from JWT_SECRET (stable per instance)
export const ENCRYPTION_KEY = crypto.createHash('sha256').update(JWT_SECRET).digest();
