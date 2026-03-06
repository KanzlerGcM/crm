import express from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import db from '../database.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const templates = await db.all(`
      SELECT et.*, u.name as created_by_name
      FROM email_templates et
      LEFT JOIN users u ON et.created_by = u.id
      ORDER BY et.name ASC
    `);
    res.json(templates);
  } catch (err) {
    console.error('Email templates list error:', err);
    res.status(500).json({ error: 'Erro ao listar templates' });
  }
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
  try {
    const template = await db.get('SELECT * FROM email_templates WHERE id = ?', [id]);
    if (!template) return res.status(404).json({ error: 'Template não encontrado' });
    res.json(template);
  } catch (err) {
    console.error('Email template get error:', err);
    res.status(500).json({ error: 'Erro ao buscar template' });
  }
});

router.post('/', async (req, res) => {
  const { name, subject, body, category } = req.body;
  if (!name || !subject || !body) {
    return res.status(400).json({ error: 'Nome, assunto e corpo são obrigatórios' });
  }
  try {
    const result = await db.run(
      `INSERT INTO email_templates (name, subject, body, category, created_by) VALUES (?, ?, ?, ?, ?)`,
      [name, subject, body, category || 'general', req.user.id]
    );
    await db.audit(req.user.id, 'email_template', result.lastInsertRowid, 'created', name);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Template criado' });
  } catch (err) {
    console.error('Email template create error:', err);
    res.status(500).json({ error: 'Erro ao criar template' });
  }
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
  const { name, subject, body, category } = req.body;
  if (!name || !subject || !body) {
    return res.status(400).json({ error: 'Nome, assunto e corpo são obrigatórios' });
  }
  try {
    await db.run(
      `UPDATE email_templates SET name=?, subject=?, body=?, category=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [name, subject, body, category || 'general', id]
    );
    await db.audit(req.user.id, 'email_template', id, 'updated', name);
    res.json({ message: 'Template atualizado' });
  } catch (err) {
    console.error('Email template update error:', err);
    res.status(500).json({ error: 'Erro ao atualizar template' });
  }
});

router.delete('/:id', adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
  try {
    await db.run('DELETE FROM email_templates WHERE id=?', [id]);
    await db.audit(req.user.id, 'email_template', id, 'deleted');
    res.json({ message: 'Template removido' });
  } catch (err) {
    console.error('Email template delete error:', err);
    res.status(500).json({ error: 'Erro ao remover template' });
  }
});

export default router;
