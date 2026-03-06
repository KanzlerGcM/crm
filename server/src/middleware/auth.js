import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';

const secret = JWT_SECRET;

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    secret,
    { expiresIn: '24h' }
  );
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

export function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores' });
  }
  next();
}

// RBAC: Restrict destructive operations to admin
export function adminOrOwner(ownerField = 'assigned_to') {
  return (req, res, next) => {
    if (req.user.role === 'admin') return next();
    // For entity checks, the route handler should verify ownership
    req.rbacOwnerField = ownerField;
    next();
  };
}
