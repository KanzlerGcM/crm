import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../database.js';
import { generateToken, authMiddleware, adminOnly } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }

    const user = await db.get('SELECT * FROM users WHERE username = ? AND active = 1', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.get('SELECT id, username, name, role, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(user);
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/register (admin only)
router.post('/register', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { username, password, name, role } = req.body;

    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Username, senha e nome são obrigatórios' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'Senha deve conter pelo menos uma letra maiúscula e um número' });
    }

    const exists = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (exists) {
      return res.status(409).json({ error: 'Usuário já existe' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = await db.run('INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)',
      [username, hash, name, role || 'user']
    );

    res.status(201).json({ id: result.lastInsertRowid, username, name, role: role || 'user' });
  } catch (error) {
    console.error('Erro ao registrar:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/auth/change-password
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
    }
    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res.status(400).json({ error: 'Senha deve conter pelo menos uma letra maiúscula e um número' });
    }

    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);

    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    res.json({ message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/auth/users (admin only)
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const users = await db.all('SELECT id, username, name, role, active, created_at FROM users');
    res.json(users);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/auth/users/:id/toggle-active (admin only)
router.put('/users/:id/toggle-active', authMiddleware, adminOnly, async (req, res) => {
  try {
    const user = await db.get('SELECT id, username, active FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (user.id === req.user.id) return res.status(400).json({ error: 'Você não pode desativar sua própria conta' });

    const newActive = user.active ? 0 : 1;
    await db.run('UPDATE users SET active = ? WHERE id = ?', [newActive, req.params.id]);
    res.json({ message: `Usuário ${newActive ? 'ativado' : 'desativado'} com sucesso`, active: newActive });
  } catch (error) {
    console.error('Erro ao alterar status do usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/auth/users/:id/role (admin only)
router.put('/users/:id/role', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Função inválida' });

    const user = await db.get('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    await db.run('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    res.json({ message: 'Função atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao alterar função:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
