code = r"""import { Router } from 'express';
import db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';
import { emitDataChange } from '../socket.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { status, client_id, contract_id, month, year, page = '1', limit = '50' } = req.query;
    let sql = `SELECT p.*, c.company_name, c.contact_name, ct.contract_number, ct.plan_type
      FROM payments p LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN contracts ct ON p.contract_id = ct.id WHERE 1=1`;
    let countSql = 'SELECT COUNT(*) as total FROM payments p WHERE 1=1';
    const params = []; const countParams = [];
    if (status && status !== 'all') {
      sql += ' AND p.status = ?'; countSql += ' AND p.status = ?';
      params.push(status); countParams.push(status);
    }
    if (client_id) {
      sql += ' AND p.client_id = ?'; countSql += ' AND p.client_id = ?';
      params.push(Number(client_id)); countParams.push(Number(client_id));
    }
    if (contract_id) {
      sql += ' AND p.contract_id = ?'; countSql += ' AND p.contract_id = ?';
      params.push(Number(contract_id)); countParams.push(Number(contract_id));
    }
    if (month && year) {
      sql += " AND to_char(p.due_date::DATE, 'MM') = ? AND to_char(p.due_date::DATE, 'YYYY') = ?";
      countSql += " AND to_char(p.due_date::DATE, 'MM') = ? AND to_char(p.due_date::DATE, 'YYYY') = ?";
      params.push(String(month).padStart(2, '0'), String(year));
      countParams.push(String(month).padStart(2, '0'), String(year));
    } else if (year) {
      sql += " AND to_char(p.due_date::DATE, 'YYYY') = ?";
      countSql += " AND to_char(p.due_date::DATE, 'YYYY') = ?";
      params.push(String(year)); countParams.push(String(year));
    }
    sql += ' ORDER BY p.due_date ASC';
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
    sql += ' LIMIT ? OFFSET ?'; params.push(limitNum, (pageNum - 1) * limitNum);
    const totalRow = await db.get(countSql, countParams);
    const payments = await db.all(sql, params);
    res.json({ data: payments, pagination: { page: pageNum, limit: limitNum, total: totalRow?.total || 0, totalPages: Math.ceil((totalRow?.total || 0) / limitNum) } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao listar pagamentos' }); }
});

router.get('/stats', async (req, res) => {
  try {
    const [rec, pend, ov, cpend, cov, cpaid, monthly] = await Promise.all([
      db.get("SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE status='paid'"),
      db.get("SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE status='pending'"),
      db.get("SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE status='pending' AND due_date < CURRENT_DATE"),
      db.get("SELECT COUNT(*) as count FROM payments WHERE status='pending'"),
      db.get("SELECT COUNT(*) as count FROM payments WHERE status='pending' AND due_date < CURRENT_DATE"),
      db.get("SELECT COUNT(*) as count FROM payments WHERE status='paid'"),
      db.all("SELECT to_char(paid_date::DATE,'YYYY-MM') as month, SUM(amount) as total FROM payments WHERE status='paid' AND paid_date IS NOT NULL GROUP BY to_char(paid_date::DATE,'YYYY-MM') ORDER BY month DESC LIMIT 12"),
    ]);
    res.json({
      totalReceived: rec?.total || 0, totalPending: pend?.total || 0, totalOverdue: ov?.total || 0,
      countPending: cpend?.count || 0, countOverdue: cov?.count || 0, countPaid: cpaid?.count || 0,
      monthly: monthly.reverse(),
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao buscar estatisticas' }); }
});

router.post('/', async (req, res) => {
  try {
    const { contract_id, client_id, amount, due_date, status, payment_method, installment_number, notes } = req.body;
    if (!contract_id || !client_id || !amount || !due_date)
      return res.status(400).json({ error: 'Contrato, cliente, valor e vencimento sao obrigatorios' });
    if (isNaN(Number(amount)) || Number(amount) <= 0)
      return res.status(400).json({ error: 'Valor deve ser positivo' });
    const result = await db.run(
      'INSERT INTO payments (contract_id,client_id,amount,due_date,status,payment_method,installment_number,notes) VALUES (?,?,?,?,?,?,?,?)',
      [contract_id, client_id, amount, due_date, status || 'pending', payment_method || null, installment_number || 1, notes || null]
    );
    await db.audit(req.user.id, 'payment', result.lastInsertRowid, 'created', 'Pagamento criado');
    emitDataChange('payment', 'created', { id: result.lastInsertRowid }, req.user.id);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Pagamento registrado' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao registrar pagamento' }); }
});

router.post('/generate', async (req, res) => {
  try {
    const { contract_id } = req.body;
    if (!contract_id) return res.status(400).json({ error: 'ID do contrato obrigatorio' });
    const contract = await db.get('SELECT * FROM contracts WHERE id=?', [Number(contract_id)]);
    if (!contract) return res.status(404).json({ error: 'Contrato nao encontrado' });
    const existing = await db.get('SELECT COUNT(*) as count FROM payments WHERE contract_id=?', [Number(contract_id)]);
    if ((existing?.count || 0) > 0)
      return res.status(400).json({ error: 'Parcelas ja geradas para este contrato' });
    const installments = contract.installments || 1;
    const installmentValue = Math.round((contract.final_value / installments) * 100) / 100;
    const startDate = contract.start_date ? new Date(contract.start_date) : new Date();
    await db.transaction(async (t) => {
      for (let i = 0; i < installments; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        await t.run(
          "INSERT INTO payments (contract_id,client_id,amount,due_date,status,installment_number) VALUES (?,?,?,?,'pending',?)",
          [contract.id, contract.client_id, installmentValue, dueDate.toISOString().split('T')[0], i + 1]
        );
      }
    });
    res.json({ message: `${installments} parcela(s) gerada(s)`, installments });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao gerar parcelas' }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { status, paid_date, payment_method, amount, notes } = req.body;
    const payment = await db.get('SELECT * FROM payments WHERE id=?', [Number(req.params.id)]);
    if (!payment) return res.status(404).json({ error: 'Pagamento nao encontrado' });
    const paidDateValue = status === 'paid' && !payment.paid_date
      ? (paid_date || new Date().toISOString().split('T')[0])
      : (paid_date ?? payment.paid_date);
    await db.run(
      'UPDATE payments SET status=?,paid_date=?,payment_method=?,amount=?,notes=?,updated_at=CURRENT_TIMESTAMP,version=COALESCE(version,0)+1 WHERE id=?',
      [status ?? payment.status, paidDateValue, payment_method ?? payment.payment_method, amount ?? payment.amount, notes ?? payment.notes, Number(req.params.id)]
    );
    if (status === 'paid' && payment.status !== 'paid')
      await db.audit(req.user.id, 'payment', payment.id, 'paid', 'Pagamento confirmado');
    emitDataChange('payment', 'updated', { id: payment.id }, req.user.id);
    res.json({ message: 'Pagamento atualizado' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao atualizar pagamento' }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const payment = await db.get('SELECT * FROM payments WHERE id=?', [Number(req.params.id)]);
    if (!payment) return res.status(404).json({ error: 'Pagamento nao encontrado' });
    if (payment.status === 'paid' && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Apenas admins podem excluir pagamentos confirmados' });
    await db.run('DELETE FROM payments WHERE id=?', [Number(req.params.id)]);
    await db.audit(req.user.id, 'payment', Number(req.params.id), 'deleted', 'Pagamento excluido');
    emitDataChange('payment', 'deleted', { id: Number(req.params.id) }, req.user.id);
    res.json({ message: 'Pagamento removido' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao remover pagamento' }); }
});

router.get('/export/csv', async (req, res) => {
  try {
    const payments = await db.all(
      'SELECT p.*,c.company_name,ct.contract_number FROM payments p LEFT JOIN clients c ON p.client_id=c.id LEFT JOIN contracts ct ON p.contract_id=ct.id ORDER BY p.due_date ASC'
    );
    const STATUS_MAP = { pending: 'Pendente', paid: 'Pago', cancelled: 'Cancelado' };
    const headers = ['Contrato', 'Empresa', 'Parcela', 'Valor', 'Vencimento', 'Pagamento', 'Status', 'Metodo', 'Notas'];
    const rows = payments.map(p => [
      p.contract_number || '', p.company_name || '', p.installment_number || 1,
      p.amount || 0, p.due_date || '', p.paid_date || '',
      STATUS_MAP[p.status] || p.status, p.payment_method || '',
      (p.notes || '').replace(/[\n\r,]/g, ' '),
    ]);
    const csv = '\ufeff' + [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=pagamentos-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (err) { res.status(500).json({ error: 'Erro ao exportar' }); }
});

export default router;
"""

with open(r'C:\Users\gabri\Desktop\prospector\server\src\routes\payments.js', 'w', encoding='utf-8') as f:
    f.write(code)

lines = len(open(r'C:\Users\gabri\Desktop\prospector\server\src\routes\payments.js').readlines())
print(f'payments.js: {lines} lines')
