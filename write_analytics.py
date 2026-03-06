code = r"""import { Router } from 'express';
import db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';
import { emitDataChange, getOnlineUsers } from '../socket.js';

const router = Router();
router.use(authMiddleware);

router.get('/presence', (req, res) => {
  res.json(getOnlineUsers());
});

// Notifications aggregated
router.get('/', async (req, res) => {
  try {
    const notifications = [];
    const today = new Date().toISOString().split('T')[0];

    const [overdueFollowUps, todayFollowUps, overdueTasks, overduePayments, nearDelivery] = await Promise.all([
      db.all(`SELECT i.id, i.client_id, i.next_follow_up, i.description, i.type, c.company_name, c.contact_name FROM interactions i JOIN clients c ON i.client_id = c.id WHERE i.next_follow_up < ? AND i.next_follow_up IS NOT NULL ORDER BY i.next_follow_up ASC LIMIT 20`, [today]),
      db.all(`SELECT i.id, i.client_id, i.next_follow_up, i.description, i.type, c.company_name, c.contact_name FROM interactions i JOIN clients c ON i.client_id = c.id WHERE i.next_follow_up = ? ORDER BY i.created_at DESC LIMIT 20`, [today]),
      db.all(`SELECT t.id, t.title, t.due_date, t.client_id, c.company_name FROM tasks t LEFT JOIN clients c ON t.client_id = c.id WHERE t.due_date < ? AND t.status != 'completed' ORDER BY t.due_date ASC LIMIT 20`, [today]),
      db.all(`SELECT p.id, p.amount, p.due_date, p.contract_id, c.company_name, ct.contract_number FROM payments p JOIN clients c ON p.client_id = c.id JOIN contracts ct ON p.contract_id = ct.id WHERE p.due_date < ? AND p.status = 'pending' ORDER BY p.due_date ASC LIMIT 20`, [today]),
      db.all(`SELECT ct.id, ct.contract_number, ct.delivery_date, c.company_name FROM contracts ct JOIN clients c ON ct.client_id = c.id WHERE ct.delivery_date BETWEEN ? AND ?::DATE + INTERVAL '7 days' AND ct.status NOT IN ('completed', 'delivered', 'cancelled') ORDER BY ct.delivery_date ASC`, [today, today]),
    ]);

    overdueFollowUps.forEach(f => notifications.push({ id: `followup-${f.id}`, type: 'follow_up_overdue', severity: 'danger', title: `Follow-up atrasado: ${f.company_name}`, description: f.description, date: f.next_follow_up, link: `/clients/${f.client_id}`, entity_type: 'client', entity_id: f.client_id }));
    todayFollowUps.forEach(f => notifications.push({ id: `followup-today-${f.id}`, type: 'follow_up_today', severity: 'warning', title: `Follow-up hoje: ${f.company_name}`, description: f.description, date: f.next_follow_up, link: `/clients/${f.client_id}`, entity_type: 'client', entity_id: f.client_id }));
    overdueTasks.forEach(t => notifications.push({ id: `task-${t.id}`, type: 'task_overdue', severity: 'danger', title: `Tarefa atrasada: ${t.title}`, description: t.company_name ? `Cliente: ${t.company_name}` : null, date: t.due_date, link: '/tasks', entity_type: 'task', entity_id: t.id }));
    overduePayments.forEach(p => notifications.push({ id: `payment-${p.id}`, type: 'payment_overdue', severity: 'danger', title: `Pagamento atrasado: R$ ${Number(p.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, description: `${p.company_name} - Contrato ${p.contract_number}`, date: p.due_date, link: '/financial', entity_type: 'payment', entity_id: p.id }));
    nearDelivery.forEach(ct => notifications.push({ id: `delivery-${ct.id}`, type: 'contract_delivery', severity: 'warning', title: `Entrega proxima: ${ct.contract_number}`, description: `${ct.company_name} - Entrega: ${new Date(ct.delivery_date).toLocaleDateString('pt-BR')}`, date: ct.delivery_date, link: `/contracts/${ct.id}`, entity_type: 'contract', entity_id: ct.id }));

    const severityOrder = { danger: 0, warning: 1, info: 2 };
    notifications.sort((a, b) => {
      const sa = severityOrder[a.severity] ?? 9;
      const sb = severityOrder[b.severity] ?? 9;
      if (sa !== sb) return sa - sb;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    res.json({ notifications, counts: { total: notifications.length, danger: notifications.filter(n => n.severity === 'danger').length, warning: notifications.filter(n => n.severity === 'warning').length } });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Erro ao buscar notificacoes' });
  }
});

// Dashboard analytics
router.get('/dashboard', async (req, res) => {
  try {
    const [revenueByMonth, clientsByMonth, funnel, serviceDistribution, topClients, recentActivity, contractsByStatus, avgValue, tPending, tOverdue, tCompleted] = await Promise.all([
      db.all(`SELECT to_char(start_date, 'YYYY-MM') as month, SUM(final_value) as total, COUNT(*) as count FROM contracts WHERE start_date IS NOT NULL AND status NOT IN ('cancelled', 'draft') GROUP BY to_char(start_date, 'YYYY-MM') ORDER BY month DESC LIMIT 12`),
      db.all(`SELECT to_char(created_at, 'YYYY-MM') as month, COUNT(*) as count FROM clients GROUP BY to_char(created_at, 'YYYY-MM') ORDER BY month DESC LIMIT 12`),
      db.all('SELECT status, COUNT(*) as count FROM clients GROUP BY status'),
      db.all("SELECT plan_type, COUNT(*) as count, SUM(final_value) as total_value FROM contracts WHERE status NOT IN ('cancelled') GROUP BY plan_type"),
      db.all("SELECT c.id, c.company_name, COUNT(ct.id) as contract_count, SUM(ct.final_value) as total_value FROM clients c JOIN contracts ct ON c.id = ct.client_id WHERE ct.status NOT IN ('cancelled') GROUP BY c.id ORDER BY total_value DESC LIMIT 10"),
      db.all('SELECT a.*, u.name as user_name FROM activity_log a LEFT JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC LIMIT 20'),
      db.all('SELECT status, COUNT(*) as count FROM contracts GROUP BY status'),
      db.get("SELECT AVG(final_value) as avg_value FROM contracts WHERE status NOT IN ('cancelled', 'draft')"),
      db.get("SELECT COUNT(*) as c FROM tasks WHERE status='pending'"),
      db.get(`SELECT COUNT(*) as c FROM tasks WHERE due_date < CURRENT_DATE AND status != 'completed'`),
      db.get(`SELECT COUNT(*) as c FROM tasks WHERE status='completed' AND to_char(completed_at, 'YYYY-MM') = to_char(CURRENT_DATE, 'YYYY-MM')`),
    ]);

    res.json({
      revenueByMonth: revenueByMonth.reverse(),
      clientsByMonth: clientsByMonth.reverse(),
      funnel,
      serviceDistribution,
      topClients,
      recentActivity,
      contractsByStatus,
      avgContractValue: avgValue?.avg_value || 0,
      taskSummary: { pending: tPending?.c || 0, overdue: tOverdue?.c || 0, completedThisMonth: tCompleted?.c || 0 },
    });
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    res.status(500).json({ error: 'Erro ao buscar dados do dashboard' });
  }
});

// Global search
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || String(q).length < 2) return res.json({ results: [] });
    const term = `%${q}%`;
    const [clients, contracts, tasks] = await Promise.all([
      db.all("SELECT id, company_name, contact_name, email, phone, status, 'client' as entity_type FROM clients WHERE company_name ILIKE ? OR contact_name ILIKE ? OR email ILIKE ? OR phone ILIKE ? OR cnpj ILIKE ? LIMIT 10", [term, term, term, term, term]),
      db.all("SELECT ct.id, ct.contract_number, ct.plan_type, ct.status, ct.final_value, c.company_name, 'contract' as entity_type FROM contracts ct JOIN clients c ON ct.client_id = c.id WHERE ct.contract_number ILIKE ? OR c.company_name ILIKE ? LIMIT 10", [term, term]),
      db.all("SELECT t.id, t.title, t.status, t.due_date, c.company_name, 'task' as entity_type FROM tasks t LEFT JOIN clients c ON t.client_id = c.id WHERE t.title ILIKE ? OR t.description ILIKE ? LIMIT 10", [term, term]),
    ]);
    res.json({
      results: [
        ...clients.map(c => ({ ...c, label: c.company_name, sublabel: c.contact_name, link: `/clients/${c.id}` })),
        ...contracts.map(c => ({ ...c, label: c.contract_number, sublabel: c.company_name, link: `/contracts/${c.id}` })),
        ...tasks.map(t => ({ ...t, label: t.title, sublabel: t.company_name || 'Sem cliente', link: '/tasks' })),
      ],
      counts: { clients: clients.length, contracts: contracts.length, tasks: tasks.length },
    });
  } catch (err) {
    console.error('Error in global search:', err);
    res.status(500).json({ error: 'Erro na busca' });
  }
});

// Calendar events (aggregated)
router.get('/calendar', async (req, res) => {
  try {
    const { start, end } = req.query;
    const events = [];

    // Follow-ups
    let followUpSql = `SELECT i.id, i.next_follow_up as date, i.type, i.description, c.company_name, c.id as client_id FROM interactions i JOIN clients c ON i.client_id = c.id WHERE i.next_follow_up IS NOT NULL`;
    const fParams = [];
    if (start) { followUpSql += ' AND i.next_follow_up >= ?'; fParams.push(start); }
    if (end) { followUpSql += ' AND i.next_follow_up <= ?'; fParams.push(end); }
    followUpSql += ' ORDER BY i.next_follow_up';
    const followUps = await db.all(followUpSql, fParams);
    followUps.forEach(f => events.push({ id: `followup-${f.id}`, title: `Follow-up: ${f.company_name}`, date: f.date, type: 'follow_up', color: '#f59e0b', link: `/clients/${f.client_id}`, description: f.description }));

    // Task deadlines
    let taskSql = `SELECT t.id, t.due_date as date, t.title, t.status, t.priority, c.company_name FROM tasks t LEFT JOIN clients c ON t.client_id = c.id WHERE t.due_date IS NOT NULL`;
    const tParams = [];
    if (start) { taskSql += ' AND t.due_date >= ?'; tParams.push(start); }
    if (end) { taskSql += ' AND t.due_date <= ?'; tParams.push(end); }
    const taskEvts = await db.all(taskSql, tParams);
    taskEvts.forEach(t => events.push({ id: `task-${t.id}`, title: t.title, date: t.date, type: 'task', color: t.status === 'completed' ? '#10b981' : t.priority === 'urgent' ? '#ef4444' : '#3b82f6', link: '/tasks', description: t.company_name || '' }));

    // Contract deliveries
    let ctSql = `SELECT ct.id, ct.delivery_date as date, ct.contract_number, ct.status, c.company_name FROM contracts ct JOIN clients c ON ct.client_id = c.id WHERE ct.delivery_date IS NOT NULL`;
    const cParams = [];
    if (start) { ctSql += ' AND ct.delivery_date >= ?'; cParams.push(start); }
    if (end) { ctSql += ' AND ct.delivery_date <= ?'; cParams.push(end); }
    const ctEvts = await db.all(ctSql, cParams);
    ctEvts.forEach(ct => events.push({ id: `contract-${ct.id}`, title: `Entrega: ${ct.contract_number}`, date: ct.date, type: 'contract', color: '#7c5ce0', link: `/contracts/${ct.id}`, description: ct.company_name }));

    // Payment due dates
    let pSql = `SELECT p.id, p.due_date as date, p.amount, p.status, c.company_name, ct.contract_number FROM payments p JOIN clients c ON p.client_id = c.id JOIN contracts ct ON p.contract_id = ct.id WHERE 1=1`;
    const pParams = [];
    if (start) { pSql += ' AND p.due_date >= ?'; pParams.push(start); }
    if (end) { pSql += ' AND p.due_date <= ?'; pParams.push(end); }
    const pEvts = await db.all(pSql, pParams);
    pEvts.forEach(p => events.push({ id: `payment-${p.id}`, title: `R$ ${Number(p.amount).toLocaleString('pt-BR')} - ${p.company_name}`, date: p.date, type: 'payment', color: p.status === 'paid' ? '#10b981' : '#ef4444', link: '/financial', description: `Contrato ${p.contract_number}` }));

    // Custom calendar events
    let evSql = `SELECT ce.id, ce.title, ce.description, ce.date, ce.time, ce.end_date, ce.end_time, ce.color, ce.category, ce.all_day, ce.created_by, u.name as creator_name FROM calendar_events ce LEFT JOIN users u ON ce.created_by = u.id WHERE 1=1`;
    const evParams = [];
    if (start) { evSql += ' AND ce.date >= ?'; evParams.push(start); }
    if (end) { evSql += ' AND (ce.end_date <= ? OR ce.date <= ?)'; evParams.push(end, end); }
    const cEvts = await db.all(evSql, evParams);
    cEvts.forEach(ev => events.push({ id: `event-${ev.id}`, title: ev.title, date: ev.date, type: 'event', color: ev.color || '#0077FF', link: '', description: ev.description || '', time: ev.time, end_date: ev.end_date, end_time: ev.end_time, category: ev.category, all_day: ev.all_day, creator_name: ev.creator_name, editable: true, event_id: ev.id }));

    events.sort((a, b) => a.date.localeCompare(b.date));
    res.json(events);
  } catch (err) {
    console.error('Error fetching calendar:', err);
    res.status(500).json({ error: 'Erro ao buscar eventos' });
  }
});

// Activity log
router.get('/activity', async (req, res) => {
  try {
    const { entity_type, entity_id, page, limit: lim } = req.query;
    let sql = `SELECT a.*, u.name as user_name FROM activity_log a LEFT JOIN users u ON a.user_id = u.id WHERE 1=1`;
    let countSql = `SELECT COUNT(*) as total FROM activity_log a WHERE 1=1`;
    const params = []; const countParams = [];
    if (entity_type) { sql += ' AND a.entity_type = ?'; countSql += ' AND a.entity_type = ?'; params.push(entity_type); countParams.push(entity_type); }
    if (entity_id) { sql += ' AND a.entity_id = ?'; countSql += ' AND a.entity_id = ?'; params.push(Number(entity_id)); countParams.push(Number(entity_id)); }
    sql += ` ORDER BY a.created_at DESC`;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(lim) || 50));
    const offset = (pageNum - 1) * limitNum;
    sql += ` LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);
    const [totalRow, activities] = await Promise.all([db.get(countSql, countParams), db.all(sql, params)]);
    res.json({ data: activities, pagination: { page: pageNum, limit: limitNum, total: totalRow?.total || 0, totalPages: Math.ceil((totalRow?.total || 0) / limitNum) } });
  } catch (err) {
    console.error('Error fetching activities:', err);
    res.status(500).json({ error: 'Erro ao buscar atividades' });
  }
});

// Create calendar event
router.post('/calendar/events', async (req, res) => {
  try {
    const { title, description, date, time, end_date, end_time, color, category, all_day } = req.body;
    if (!title || !date) return res.status(400).json({ error: 'Titulo e data sao obrigatorios' });
    const result = await db.run(
      `INSERT INTO calendar_events (title, description, date, time, end_date, end_time, color, category, all_day, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description || null, date, time || null, end_date || null, end_time || null, color || '#0077FF', category || 'event', all_day !== undefined ? (all_day ? 1 : 0) : 1, req.user.id]
    );
    await db.audit(req.user.id, 'calendar_event', result.lastInsertRowid, 'created', `Evento criado: ${title}`);
    emitDataChange('calendar_event', 'created', { id: result.lastInsertRowid, title, date }, req.user.id);
    res.json({ id: result.lastInsertRowid, message: 'Evento criado com sucesso' });
  } catch (err) {
    console.error('Error creating calendar event:', err);
    res.status(500).json({ error: 'Erro ao criar evento' });
  }
});

// Update calendar event
router.put('/calendar/events/:id', async (req, res) => {
  try {
    const { title, description, date, time, end_date, end_time, color, category, all_day } = req.body;
    if (!title || !date) return res.status(400).json({ error: 'Titulo e data sao obrigatorios' });
    const result = await db.run(
      `UPDATE calendar_events SET title=?, description=?, date=?, time=?, end_date=?, end_time=?, color=?, category=?, all_day=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [title, description || null, date, time || null, end_date || null, end_time || null, color || '#0077FF', category || 'event', all_day !== undefined ? (all_day ? 1 : 0) : 1, Number(req.params.id)]
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Evento nao encontrado' });
    emitDataChange('calendar_event', 'updated', { id: Number(req.params.id), title, date }, req.user.id);
    res.json({ message: 'Evento atualizado com sucesso' });
  } catch (err) {
    console.error('Error updating calendar event:', err);
    res.status(500).json({ error: 'Erro ao atualizar evento' });
  }
});

// Delete calendar event
router.delete('/calendar/events/:id', async (req, res) => {
  try {
    const result = await db.run('DELETE FROM calendar_events WHERE id=?', [Number(req.params.id)]);
    if (result.changes === 0) return res.status(404).json({ error: 'Evento nao encontrado' });
    emitDataChange('calendar_event', 'deleted', { id: Number(req.params.id) }, req.user.id);
    res.json({ message: 'Evento excluido com sucesso' });
  } catch (err) {
    console.error('Error deleting calendar event:', err);
    res.status(500).json({ error: 'Erro ao excluir evento' });
  }
});

export default router;
"""

with open(r'C:\Users\gabri\Desktop\prospector\server\src\routes\analytics.js', 'w', encoding='utf-8') as f:
    f.write(code)
print(f'analytics.js: {len(open(r"C:\Users\gabri\Desktop\prospector\server\src\routes\analytics.js", encoding="utf-8").readlines())} lines')
