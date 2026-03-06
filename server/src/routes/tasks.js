import { Router } from 'express';
import db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';
import { emitDataChange } from '../socket.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { status, priority, client_id, assigned_to, due_date, search, page = '1', limit = '50' } = req.query;
    let sql = `SELECT t.*, c.company_name, c.contact_name, ct.contract_number
      FROM tasks t
      LEFT JOIN clients c ON t.client_id = c.id
      LEFT JOIN contracts ct ON t.contract_id = ct.id
      WHERE 1=1`;
    let countSql = `SELECT COUNT(*) as total FROM tasks t WHERE 1=1`;
    const params = []; const countParams = [];

    if (status && status !== 'all') { sql += ' AND t.status = ?'; countSql += ' AND t.status = ?'; params.push(status); countParams.push(status); }
    if (priority) { sql += ' AND t.priority = ?'; countSql += ' AND t.priority = ?'; params.push(priority); countParams.push(priority); }
    if (client_id) { sql += ' AND t.client_id = ?'; countSql += ' AND t.client_id = ?'; params.push(Number(client_id)); countParams.push(Number(client_id)); }
    if (assigned_to) { sql += ' AND t.assigned_to = ?'; countSql += ' AND t.assigned_to = ?'; params.push(Number(assigned_to)); countParams.push(Number(assigned_to)); }
    if (due_date === 'overdue') {
      const cond = " AND t.due_date < CURRENT_DATE AND t.status != 'completed'";
      sql += cond; countSql += cond;
    } else if (due_date === 'today') {
      const cond = ' AND t.due_date = CURRENT_DATE';
      sql += cond; countSql += cond;
    } else if (due_date === 'week') {
      const cond = " AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'";
      sql += cond; countSql += cond;
    }
    if (search) {
      sql += ' AND (t.title LIKE ? OR t.description LIKE ?)';
      countSql += ' AND (t.title LIKE ? OR t.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`); countParams.push(`%${search}%`, `%${search}%`);
    }

    sql += " ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.due_date ASC NULLS LAST, t.created_at DESC";
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;
    sql += ' LIMIT ? OFFSET ?'; params.push(limitNum, offset);

    const totalRow = await db.get(countSql, countParams);
    const total = totalRow?.total || 0;
    const tasks = await db.all(sql, params);
    res.json({ data: tasks, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
  } catch (err) {
    console.error('Error listing tasks:', err);
    res.status(500).json({ error: 'Erro ao listar tarefas' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const [total, pending, inProgress, completed, overdue, todayTasks] = await Promise.all([
      db.get('SELECT COUNT(*) as count FROM tasks'),
      db.get("SELECT COUNT(*) as count FROM tasks WHERE status = 'pending'"),
      db.get("SELECT COUNT(*) as count FROM tasks WHERE status = 'in_progress'"),
      db.get("SELECT COUNT(*) as count FROM tasks WHERE status = 'completed'"),
      db.get("SELECT COUNT(*) as count FROM tasks WHERE due_date < CURRENT_DATE AND status != 'completed'"),
      db.get("SELECT COUNT(*) as count FROM tasks WHERE due_date = CURRENT_DATE AND status != 'completed'"),
    ]);
    res.json({ total: total?.count || 0, pending: pending?.count || 0, in_progress: inProgress?.count || 0, completed: completed?.count || 0, overdue: overdue?.count || 0, today: todayTasks?.count || 0 });
  } catch (err) {
    console.error('Error fetching task stats:', err);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, description, client_id, contract_id, assigned_to, priority, due_date } = req.body;
    if (!title) return res.status(400).json({ error: 'Título é obrigatório' });
    const result = await db.run(
      `INSERT INTO tasks (title, description, client_id, contract_id, assigned_to, priority, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, description || null, client_id || null, contract_id || null, assigned_to || req.user.id, priority || 'medium', due_date || null]
    );
    await db.audit(req.user.id, 'task', result.lastInsertRowid, 'created', `Tarefa criada: ${title}`);
    emitDataChange('task', 'created', { id: result.lastInsertRowid, title }, req.user.id);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Tarefa criada' });
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: 'Erro ao criar tarefa' });
  }
});

router.post('/bulk/status', async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'IDs são obrigatórios' });
    const validStatuses = ['pending', 'in_progress', 'completed'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Status inválido' });
    const safeIds = ids.filter(id => Number.isInteger(id) && id > 0);
    if (safeIds.length === 0) return res.status(400).json({ error: 'Nenhum ID válido' });
    const completedAt = status === 'completed' ? new Date().toISOString() : null;
    await db.run(`UPDATE tasks SET status=?, completed_at=?, updated_at=CURRENT_TIMESTAMP WHERE id = ANY(?)`, [status, completedAt, safeIds]);
    await Promise.all(safeIds.map(id => db.audit(req.user.id, 'task', id, 'bulk_status', `Status alterado para ${status}`)));
    emitDataChange('task', 'updated', { ids: safeIds }, req.user.id);
    res.json({ message: `${safeIds.length} tarefa(s) atualizada(s)`, updated: safeIds.length });
  } catch (error) {
    console.error('Bulk task status error:', error);
    res.status(500).json({ error: 'Erro ao atualizar tarefas' });
  }
});

router.delete('/bulk', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'IDs são obrigatórios' });
    const safeIds = ids.filter(id => Number.isInteger(id) && id > 0);
    if (safeIds.length === 0) return res.status(400).json({ error: 'Nenhum ID válido' });
    if (req.user.role !== 'admin') {
      const owned = await db.all(`SELECT id FROM tasks WHERE id = ANY(?) AND assigned_to = ?`, [safeIds, req.user.id]);
      const ownedIds = new Set(owned.map(t => t.id));
      const notOwned = safeIds.filter(id => !ownedIds.has(id));
      if (notOwned.length > 0) return res.status(403).json({ error: 'Você só pode excluir suas próprias tarefas' });
    }
    const result = await db.run(`DELETE FROM tasks WHERE id = ANY(?)`, [safeIds]);
    await Promise.all(safeIds.map(id => db.audit(req.user.id, 'task', id, 'bulk_deleted', 'Exclusão em massa')));
    emitDataChange('task', 'deleted', { ids: safeIds }, req.user.id);
    res.json({ message: `${result.changes} tarefa(s) removida(s)`, deleted: result.changes });
  } catch (error) {
    console.error('Bulk task delete error:', error);
    res.status(500).json({ error: 'Erro ao remover tarefas' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, description, client_id, contract_id, assigned_to, status, priority, due_date } = req.body;
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [Number(req.params.id)]);
    if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
    if (req.body.version !== undefined && task.version !== undefined) {
      if (Number(req.body.version) !== task.version) return res.status(409).json({ error: 'Este registro foi modificado por outro usuário. Recarregue e tente novamente.', conflict: true });
    }
    const completedAt = status === 'completed' && task.status !== 'completed' ? new Date().toISOString() : task.completed_at;
    await db.run(
      `UPDATE tasks SET title=?, description=?, client_id=?, contract_id=?, assigned_to=?, status=?, priority=?, due_date=?, completed_at=?, version=COALESCE(version,0)+1, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [title ?? task.title, description ?? task.description, client_id ?? task.client_id, contract_id ?? task.contract_id, assigned_to ?? task.assigned_to, status ?? task.status, priority ?? task.priority, due_date ?? task.due_date, completedAt, Number(req.params.id)]
    );
    if (status && status !== task.status) await db.audit(req.user.id, 'task', task.id, 'status_changed', `Status: ${task.status} → ${status}`);
    emitDataChange('task', 'updated', { id: task.id, status: status ?? task.status }, req.user.id);
    res.json({ message: 'Tarefa atualizada' });
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Erro ao atualizar tarefa' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
    if (req.user.role !== 'admin' && task.assigned_to !== req.user.id) return res.status(403).json({ error: 'Você só pode excluir suas próprias tarefas' });
    await db.run('DELETE FROM tasks WHERE id = ?', [id]);
    await db.audit(req.user.id, 'task', id, 'deleted', `Tarefa excluída: ${task.title}`);
    emitDataChange('task', 'deleted', { id }, req.user.id);
    res.json({ message: 'Tarefa removida' });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: 'Erro ao remover tarefa' });
  }
});

router.post('/process-recurring', async (req, res) => {
  try {
    const now = new Date();
    const recurring = await db.all(`SELECT * FROM tasks WHERE recurrence_rule IS NOT NULL AND status = 'completed' AND recurrence_rule IN ('daily', 'weekly', 'monthly')`);
    let created = 0;
    for (const task of recurring) {
      const lastAt = task.last_recurrence_at ? new Date(task.last_recurrence_at) : new Date(task.completed_at || task.created_at);
      const nextDue = new Date(lastAt);
      if (task.recurrence_rule === 'daily') nextDue.setDate(nextDue.getDate() + 1);
      else if (task.recurrence_rule === 'weekly') nextDue.setDate(nextDue.getDate() + 7);
      else if (task.recurrence_rule === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1);
      if (nextDue <= now) {
        const dueDate = nextDue.toISOString().split('T')[0];
        await db.run(
          `INSERT INTO tasks (title, description, client_id, contract_id, assigned_to, priority, due_date, recurrence_rule) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [task.title, task.description, task.client_id, task.contract_id, task.assigned_to, task.priority, dueDate, task.recurrence_rule]
        );
        await db.run('UPDATE tasks SET last_recurrence_at = CURRENT_TIMESTAMP WHERE id = ?', [task.id]);
        created++;
      }
    }
    await db.audit(req.user.id, 'task', null, 'recurring_processed', `${created} tarefas recorrentes criadas`);
    res.json({ message: `${created} tarefas recorrentes criadas`, created });
  } catch (err) {
    console.error('Error processing recurring tasks:', err);
    res.status(500).json({ error: 'Erro ao processar tarefas recorrentes' });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const tasks = await db.all(`SELECT t.*, c.company_name, u.name as assigned_name FROM tasks t LEFT JOIN clients c ON t.client_id = c.id LEFT JOIN users u ON t.assigned_to = u.id ORDER BY t.created_at DESC`);
    const STATUS_MAP = { pending: 'Pendente', in_progress: 'Em Andamento', completed: 'Concluída' };
    const PRIO_MAP = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' };
    const headers = ['Título','Descrição','Cliente','Responsável','Status','Prioridade','Prazo','Concluída em','Criada em'];
    const rows = tasks.map(t => [t.title,(t.description||'').replace(/[\n\r,]/g,' '),t.company_name||'',t.assigned_name||'',STATUS_MAP[t.status]||t.status,PRIO_MAP[t.priority]||t.priority,t.due_date||'',t.completed_at||'',t.created_at||'']);
    const csv = '\ufeff' + [headers,...rows].map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename=tarefas-chevla-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (err) { res.status(500).json({ error: 'Erro ao exportar' }); }
});

export default router;
