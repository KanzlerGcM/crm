code = r"""import { Router } from 'express';
import db from '../database.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { emitDataChange } from '../socket.js';

const router = Router();
router.use(authMiddleware);

// GET /api/clients
router.get('/', async (req, res) => {
  try {
    const { status, interest, priority, search, sort, order, page, limit } = req.query;
    let query = 'SELECT c.*, u.name as assigned_name FROM clients c LEFT JOIN users u ON c.assigned_to = u.id WHERE 1=1';
    const params = [];

    if (status) { query += ' AND c.status = ?'; params.push(status); }
    if (interest) { query += ' AND c.interest = ?'; params.push(interest); }
    if (priority) { query += ' AND c.priority = ?'; params.push(priority); }
    if (search) {
      query += ' AND (c.company_name ILIKE ? OR c.contact_name ILIKE ? OR c.email ILIKE ? OR c.phone ILIKE ? OR c.cnpj ILIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    const countQuery = query.replace(
      'SELECT c.*, u.name as assigned_name FROM clients c LEFT JOIN users u ON c.assigned_to = u.id',
      'SELECT COUNT(*) as total FROM clients c'
    );
    const countRow = await db.get(countQuery, params);
    const total = countRow?.total || 0;

    const validSorts = ['company_name', 'contact_name', 'status', 'priority', 'created_at', 'updated_at', 'estimated_value'];
    const sortField = validSorts.includes(sort) ? `c.${sort}` : 'c.created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortField} ${sortOrder}`;

    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 25, 100);
    const offset = (pageNum - 1) * limitNum;
    query += ' LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const clients = await db.all(query, params);
    res.json({ data: clients, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } });
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/clients/stats
router.get('/stats', async (req, res) => {
  try {
    const [statusCounts, interestCounts, priorityCounts, totalEstimated, monthlyNew, pendingFollowUps, contractStats] = await Promise.all([
      db.all('SELECT status, COUNT(*) as count FROM clients GROUP BY status'),
      db.all('SELECT interest, COUNT(*) as count FROM clients WHERE interest IS NOT NULL GROUP BY interest'),
      db.all('SELECT priority, COUNT(*) as count FROM clients GROUP BY priority'),
      db.get("SELECT COALESCE(SUM(estimated_value), 0) as total FROM clients WHERE status NOT IN ('lost')"),
      db.all(`SELECT to_char(created_at, 'YYYY-MM') as month, COUNT(*) as count FROM clients WHERE created_at >= CURRENT_DATE - INTERVAL '6 months' GROUP BY month ORDER BY month`),
      db.get(`SELECT COUNT(*) as count FROM interactions WHERE next_follow_up IS NOT NULL AND next_follow_up <= CURRENT_DATE + INTERVAL '3 days'`),
      db.all('SELECT status, COUNT(*) as count, COALESCE(SUM(final_value), 0) as total_value FROM contracts GROUP BY status'),
    ]);
    res.json({ statusCounts, interestCounts, priorityCounts, totalEstimatedValue: totalEstimated?.total || 0, monthlyNew, pendingFollowUps: pendingFollowUps?.count || 0, contractStats });
  } catch (error) {
    console.error('Erro ao buscar estatisticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/clients/calculate-lead-scores
router.post('/calculate-lead-scores', async (req, res) => {
  try {
    const clients = await db.all('SELECT * FROM clients');
    let updated = 0;
    for (const client of clients) {
      let score = 0;
      if (client.email) score += 5;
      if (client.phone) score += 5;
      if (client.cnpj) score += 5;
      if (client.website) score += 5;
      if (client.city) score += 3;
      if (client.contact_name) score += 5;
      const statusScores = { prospect: 5, contacted: 15, negotiating: 30, proposal_sent: 45, client: 60, lost: 0 };
      score += statusScores[client.status] || 0;
      const priorityScores = { low: 2, medium: 5, high: 10, urgent: 15 };
      score += priorityScores[client.priority] || 0;
      const interactions = await db.get('SELECT COUNT(*) as cnt FROM interactions WHERE client_id = ?', [client.id]);
      score += Math.min(20, (interactions?.cnt || 0) * 3);
      const recentInteraction = await db.get(
        "SELECT COUNT(*) as cnt FROM interactions WHERE client_id = ? AND created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'",
        [client.id]
      );
      if (recentInteraction?.cnt > 0) score += 10;
      if (client.estimated_value) {
        if (client.estimated_value >= 10000) score += 15;
        else if (client.estimated_value >= 5000) score += 10;
        else if (client.estimated_value >= 1000) score += 5;
      }
      const contracts = await db.get('SELECT COUNT(*) as cnt FROM contracts WHERE client_id = ?', [client.id]);
      score += Math.min(15, (contracts?.cnt || 0) * 5);
      score = Math.min(100, Math.max(0, score));
      await db.run('UPDATE clients SET lead_score = ? WHERE id = ?', [score, client.id]);
      updated++;
    }
    await db.audit(req.user.id, 'client', null, 'lead_scores_calculated', `${updated} leads recalculados`);
    res.json({ message: `Lead scores recalculados para ${updated} clientes`, updated });
  } catch (error) {
    console.error('Erro ao calcular lead scores:', error);
    res.status(500).json({ error: 'Erro ao calcular lead scores' });
  }
});

// GET /api/clients/follow-ups/pending (MUST be before /:id)
router.get('/follow-ups/pending', async (req, res) => {
  try {
    const followUps = await db.all(`
      SELECT i.*, c.company_name, c.contact_name, c.phone, c.email, c.status as client_status,
             c.interest, u.name as user_name
      FROM interactions i JOIN clients c ON i.client_id = c.id LEFT JOIN users u ON i.user_id = u.id
      WHERE i.next_follow_up IS NOT NULL AND i.next_follow_up <= CURRENT_DATE + INTERVAL '7 days'
      ORDER BY i.next_follow_up ASC`);
    res.json(followUps);
  } catch (error) {
    console.error('Erro ao buscar follow-ups:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/clients/export/csv
router.get('/export/csv', async (req, res) => {
  try {
    const clients = await db.all('SELECT c.*, u.name as assigned_name FROM clients c LEFT JOIN users u ON c.assigned_to = u.id ORDER BY c.created_at DESC');
    const STATUS_MAP = { prospect: 'Prospect', contacted: 'Contactado', negotiating: 'Negociando', proposal_sent: 'Proposta Enviada', client: 'Cliente', lost: 'Perdido' };
    const INTEREST_MAP = { institutional: 'Site Institucional', institutional_blog: 'Site + Blog', ecommerce: 'E-commerce', essential_maintenance: 'Manut. Essencial', pro_maintenance: 'Manut. Pro', multiple: 'Multiplos' };
    const headers = ['Empresa', 'Contato', 'E-mail', 'Telefone', 'CNPJ', 'Cidade', 'Estado', 'Status', 'Interesse', 'Prioridade', 'Valor Estimado', 'Origem', 'Notas', 'Criado em'];
    const rows = clients.map(c => [c.company_name, c.contact_name, c.email || '', c.phone || '', c.cnpj || '', c.city || '', c.state || '', STATUS_MAP[c.status] || c.status, INTEREST_MAP[c.interest] || c.interest || '', c.priority || '', c.estimated_value || '', c.source || '', (c.notes || '').replace(/[\n\r,]/g, ' '), c.created_at || '']);
    const csvContent = '\ufeff' + [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=clientes-chevla-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvContent);
  } catch (error) {
    console.error('Erro ao exportar:', error);
    res.status(500).json({ error: 'Erro ao exportar dados' });
  }
});

// POST /api/clients/bulk/status
router.post('/bulk/status', async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'IDs sao obrigatorios' });
    const validStatuses = ['prospect', 'contacted', 'negotiating', 'proposal_sent', 'client', 'lost'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Status invalido' });
    const safeIds = ids.filter(id => Number.isInteger(id) && id > 0);
    if (safeIds.length === 0) return res.status(400).json({ error: 'Nenhum ID valido' });
    const result = await db.run('UPDATE clients SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id = ANY(?)', [status, safeIds]);
    for (const id of safeIds) await db.audit(req.user.id, 'client', id, 'bulk_status', `Status alterado para ${status}`);
    emitDataChange('client', 'updated', { ids: safeIds }, req.user.id);
    res.json({ message: `${result.changes} cliente(s) atualizado(s)`, updated: result.changes });
  } catch (error) {
    console.error('Bulk status error:', error);
    res.status(500).json({ error: 'Erro ao atualizar clientes' });
  }
});

// DELETE /api/clients/bulk
router.delete('/bulk', adminOnly, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'IDs sao obrigatorios' });
    const safeIds = ids.filter(id => Number.isInteger(id) && id > 0);
    if (safeIds.length === 0) return res.status(400).json({ error: 'Nenhum ID valido' });
    const result = await db.run('DELETE FROM clients WHERE id = ANY(?)', [safeIds]);
    for (const id of safeIds) await db.audit(req.user.id, 'client', id, 'bulk_deleted', 'Exclusao em massa');
    emitDataChange('client', 'deleted', { ids: safeIds }, req.user.id);
    res.json({ message: `${result.changes} cliente(s) removido(s)`, deleted: result.changes });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Erro ao remover clientes' });
  }
});

// GET /api/clients/:id
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID invalido' });
    const client = await db.get('SELECT c.*, u.name as assigned_name FROM clients c LEFT JOIN users u ON c.assigned_to = u.id WHERE c.id = ?', [id]);
    if (!client) return res.status(404).json({ error: 'Cliente nao encontrado' });
    const [interactions, contracts, emailsSent] = await Promise.all([
      db.all('SELECT i.*, u.name as user_name FROM interactions i LEFT JOIN users u ON i.user_id = u.id WHERE i.client_id = ? ORDER BY i.created_at DESC', [id]),
      db.all('SELECT * FROM contracts WHERE client_id = ? ORDER BY created_at DESC', [id]),
      db.all("SELECT es.id, 'email_sent' as type, es.subject as description, es.to_address, es.created_at, NULL as user_name, NULL as next_follow_up FROM emails_sent es WHERE es.client_id = ? ORDER BY es.created_at DESC", [id]),
    ]);
    res.json({ ...client, interactions, contracts, emailsSent });
  } catch (error) {
    console.error('Erro ao buscar cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/clients
router.post('/', async (req, res) => {
  try {
    const { company_name, contact_name, email, phone, cnpj, address, city, state, website, status, interest, source, notes, priority, estimated_value, assigned_to } = req.body;
    if (!company_name || !contact_name) return res.status(400).json({ error: 'Nome da empresa e contato sao obrigatorios' });
    const validationError = validateBody(req.body, { email: { email: true }, phone: { phone: true }, cnpj: { cnpj: true }, website: { url: true }, estimated_value: { type: 'number', min: 0 } });
    if (validationError) return res.status(400).json({ error: validationError });
    const result = await db.run(
      'INSERT INTO clients (company_name,contact_name,email,phone,cnpj,address,city,state,website,status,interest,source,notes,priority,estimated_value,assigned_to) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [company_name, contact_name, email||null, phone||null, cnpj||null, address||null, city||null, state||null, website||null, status||'prospect', interest||null, source||null, notes||null, priority||'medium', estimated_value||null, assigned_to||null]
    );
    const client = await db.get('SELECT * FROM clients WHERE id = ?', [result.lastInsertRowid]);
    await db.audit(req.user.id, 'client', result.lastInsertRowid, 'created', `Cliente criado: ${company_name}`);
    emitDataChange('client', 'created', client, req.user.id);
    res.status(201).json(client);
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/clients/:id
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID invalido' });
    const existing = await db.get('SELECT * FROM clients WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Cliente nao encontrado' });
    if (req.body.version !== undefined && existing.version !== undefined && Number(req.body.version) !== existing.version) {
      return res.status(409).json({ error: 'Registro modificado por outro usuario. Recarregue e tente novamente.', conflict: true, serverVersion: existing.version });
    }
    const validationError = validateBody(req.body, { email: { email: true }, phone: { phone: true }, cnpj: { cnpj: true }, website: { url: true }, estimated_value: { type: 'number', min: 0 } });
    if (validationError) return res.status(400).json({ error: validationError });
    const fields = ['company_name','contact_name','email','phone','cnpj','address','city','state','website','status','interest','source','notes','priority','estimated_value','assigned_to'];
    const merged = {};
    for (const f of fields) merged[f] = req.body[f] !== undefined ? req.body[f] : existing[f];
    await db.run(
      'UPDATE clients SET company_name=?,contact_name=?,email=?,phone=?,cnpj=?,address=?,city=?,state=?,website=?,status=?,interest=?,source=?,notes=?,priority=?,estimated_value=?,assigned_to=?,version=COALESCE(version,0)+1,updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [merged.company_name,merged.contact_name,merged.email,merged.phone,merged.cnpj,merged.address,merged.city,merged.state,merged.website,merged.status,merged.interest,merged.source,merged.notes,merged.priority,merged.estimated_value,merged.assigned_to,id]
    );
    const client = await db.get('SELECT * FROM clients WHERE id = ?', [id]);
    await db.audit(req.user.id, 'client', id, 'updated', `Cliente atualizado: ${merged.company_name}`);
    emitDataChange('client', 'updated', client, req.user.id);
    res.json(client);
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/clients/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID invalido' });
    const client = await db.get('SELECT id, company_name FROM clients WHERE id = ?', [id]);
    if (!client) return res.status(404).json({ error: 'Cliente nao encontrado' });
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas administradores podem excluir clientes' });
    await db.run('DELETE FROM clients WHERE id = ?', [id]);
    await db.audit(req.user.id, 'client', id, 'deleted', `Cliente excluido: ${client.company_name}`);
    emitDataChange('client', 'deleted', { id }, req.user.id);
    res.json({ message: 'Cliente e dados relacionados removidos com sucesso' });
  } catch (error) {
    console.error('Erro ao remover cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/clients/:id/interactions
router.post('/:id/interactions', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID invalido' });
    const client = await db.get('SELECT id FROM clients WHERE id = ?', [id]);
    if (!client) return res.status(404).json({ error: 'Cliente nao encontrado' });
    const { type, description, next_follow_up } = req.body;
    if (!type || !description) return res.status(400).json({ error: 'Tipo e descricao sao obrigatorios' });
    const result = await db.run('INSERT INTO interactions (client_id,user_id,type,description,next_follow_up) VALUES (?,?,?,?,?)',
      [id, req.user.id, type, description, next_follow_up || null]);
    await db.run('UPDATE clients SET updated_at=CURRENT_TIMESTAMP WHERE id=?', [id]);
    const interaction = await db.get('SELECT i.*, u.name as user_name FROM interactions i LEFT JOIN users u ON i.user_id = u.id WHERE i.id = ?', [result.lastInsertRowid]);
    res.status(201).json(interaction);
  } catch (error) {
    console.error('Erro ao adicionar interacao:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/clients/:id/interactions/:interactionId
router.delete('/:id/interactions/:interactionId', async (req, res) => {
  try {
    const result = await db.run('DELETE FROM interactions WHERE id=? AND client_id=?', [req.params.interactionId, req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Interacao nao encontrada' });
    res.json({ message: 'Interacao removida com sucesso' });
  } catch (error) {
    console.error('Erro ao remover interacao:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
"""

with open(r'C:\Users\gabri\Desktop\prospector\server\src\routes\clients.js', 'w', encoding='utf-8') as f:
    f.write(code)

lines = len(open(r'C:\Users\gabri\Desktop\prospector\server\src\routes\clients.js').readlines())
print(f'clients.js: {lines} lines')
