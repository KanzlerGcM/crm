import { Router } from 'express';
import db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/client/:clientId', async (req, res) => {
  const clientId = Number(req.params.clientId);
  if (!Number.isInteger(clientId) || clientId <= 0) return res.status(400).json({ error: 'ID inválido' });
  try {
    const messages = await db.all(`
      SELECT wm.*, u.name as sent_by_name, c.company_name
      FROM whatsapp_messages wm
      LEFT JOIN users u ON wm.sent_by = u.id
      LEFT JOIN clients c ON wm.client_id = c.id
      WHERE wm.client_id = ?
      ORDER BY wm.created_at DESC
    `, [clientId]);
    res.json(messages);
  } catch (err) {
    console.error('WhatsApp list error:', err);
    res.status(500).json({ error: 'Erro ao listar mensagens' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { page = '1', limit = '50' } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;
    const totalRow = await db.get('SELECT COUNT(*) as total FROM whatsapp_messages');
    const total = totalRow?.total || 0;
    const messages = await db.all(`
      SELECT wm.*, u.name as sent_by_name, c.company_name, c.contact_name
      FROM whatsapp_messages wm
      LEFT JOIN users u ON wm.sent_by = u.id
      LEFT JOIN clients c ON wm.client_id = c.id
      ORDER BY wm.created_at DESC
      LIMIT ? OFFSET ?
    `, [limitNum, offset]);
    res.json({ data: messages, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
  } catch (err) {
    console.error('WhatsApp list error:', err);
    res.status(500).json({ error: 'Erro ao listar mensagens' });
  }
});

router.post('/', async (req, res) => {
  const { client_id, phone, message, template_name } = req.body;
  if (!phone || !message) return res.status(400).json({ error: 'Telefone e mensagem são obrigatórios' });
  try {
    const result = await db.run(
      `INSERT INTO whatsapp_messages (client_id, phone, message, template_name, sent_by) VALUES (?, ?, ?, ?, ?)`,
      [client_id || null, phone, message, template_name || null, req.user.id]
    );
    await db.audit(req.user.id, 'whatsapp', result.lastInsertRowid, 'sent', `WhatsApp para ${phone}`);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Mensagem registrada' });
  } catch (err) {
    console.error('WhatsApp log error:', err);
    res.status(500).json({ error: 'Erro ao registrar mensagem' });
  }
});

export default router;
