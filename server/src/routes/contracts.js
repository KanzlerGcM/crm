// ═══════════════════════════════════════
// Contract CRUD Routes
// ═══════════════════════════════════════
import { Router } from 'express';
import db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';
import { CHEVLA_SERVICES } from './contracts-shared.js';
import pdfRouter from './contracts-pdf.js';
import { emitDataChange } from '../socket.js';

const router = Router();
router.use(authMiddleware);

async function generateContractNumber() {
  const year = new Date().getFullYear();
  const prefix = `CHV-${year}-`;
  const last = await db.get(
    `SELECT contract_number FROM contracts WHERE contract_number LIKE ? ORDER BY contract_number DESC LIMIT 1`,
    [`CHV-${year}%`]
  );
  let nextNum = 1;
  if (last?.contract_number) {
    const match = last.contract_number.match(/(\d+)$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  return prefix + String(nextNum).padStart(4, '0');
}

router.get('/', async (req, res) => {
  try {
    const { status, client_id, search, page, limit } = req.query;
    let query = `SELECT ct.*, c.company_name, c.contact_name FROM contracts ct JOIN clients c ON ct.client_id = c.id WHERE 1=1`;
    let countQuery = `SELECT COUNT(*) as total FROM contracts ct JOIN clients c ON ct.client_id = c.id WHERE 1=1`;
    const params = [];
    const countParams = [];
    if (status) { query += ' AND ct.status = ?'; countQuery += ' AND ct.status = ?'; params.push(status); countParams.push(status); }
    if (client_id) { query += ' AND ct.client_id = ?'; countQuery += ' AND ct.client_id = ?'; params.push(client_id); countParams.push(client_id); }
    if (search) {
      query += ' AND (ct.contract_number ILIKE ? OR c.company_name ILIKE ?)';
      countQuery += ' AND (ct.contract_number ILIKE ? OR c.company_name ILIKE ?)';
      params.push(`%${search}%`, `%${search}%`); countParams.push(`%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY ct.created_at DESC';
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;
    const totalRow = await db.get(countQuery, countParams);
    const total = totalRow?.total || 0;
    query += ` LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);
    const data = await db.all(query, params);
    res.json({ data, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
  } catch (error) {
    console.error('Erro ao listar contratos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/renewals/upcoming', async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 30));
    const contracts = await db.all(
      `SELECT ct.*, c.company_name, c.contact_name, c.email, c.phone
       FROM contracts ct JOIN clients c ON ct.client_id = c.id
       WHERE ct.renewal_date IS NOT NULL
         AND ct.renewal_date <= CURRENT_DATE + ($1 || ' days')::INTERVAL
         AND ct.renewal_date >= CURRENT_DATE
         AND ct.status IN ('active', 'completed', 'delivered')
       ORDER BY ct.renewal_date ASC`,
      [String(days)]
    );
    res.json(contracts);
  } catch (error) {
    console.error('Erro ao buscar renovacoes:', error);
    res.status(500).json({ error: 'Erro ao buscar renovacoes' });
  }
});

router.get('/services', (req, res) => {
  try { res.json(CHEVLA_SERVICES); } catch (error) { res.status(500).json({ error: 'Erro interno do servidor' }); }
});

router.get('/export/csv', async (req, res) => {
  try {
    const contracts = await db.all(`SELECT ct.*, c.company_name, c.contact_name FROM contracts ct JOIN clients c ON ct.client_id = c.id ORDER BY ct.created_at DESC`);
    const STATUS_MAP = { draft: 'Rascunho', sent: 'Enviado', signed: 'Assinado', in_progress: 'Em Andamento', delivered: 'Entregue', completed: 'Concluido', cancelled: 'Cancelado', active: 'Ativo' };
    const headers = ['Numero', 'Empresa', 'Contato', 'Tipo', 'Plano', 'Valor', 'Desconto%', 'Valor Final', 'Status', 'Inicio', 'Entrega', 'Criado em'];
    const rows = contracts.map(c => [c.contract_number, c.company_name, c.contact_name, c.contract_type || '', c.plan_type || '', c.value || 0, c.discount_percent || 0, c.final_value || 0, STATUS_MAP[c.status] || c.status, c.start_date || '', c.delivery_date || '', c.created_at || '']);
    const csv = '\ufeff' + [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=contratos-chevla-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (err) { console.error('Export error:', err); res.status(500).json({ error: 'Erro ao exportar' }); }
});

router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID invalido' });
    const contract = await db.get(`SELECT ct.*, c.company_name, c.contact_name, c.email, c.phone, c.cnpj, c.address, c.city, c.state FROM contracts ct JOIN clients c ON ct.client_id = c.id WHERE ct.id = ?`, [id]);
    if (!contract) return res.status(404).json({ error: 'Contrato nao encontrado' });
    res.json(contract);
  } catch (error) { console.error('Erro ao buscar contrato:', error); res.status(500).json({ error: 'Erro interno do servidor' }); }
});

router.post('/', async (req, res) => {
  try {
    const { client_id, plan_type, payment_method, installments, discount_percent, start_date, delivery_date, custom_clauses, notes } = req.body;
    if (!client_id || !plan_type) return res.status(400).json({ error: 'Cliente e tipo de plano sao obrigatorios' });
    const client = await db.get('SELECT * FROM clients WHERE id = ?', [client_id]);
    if (!client) return res.status(404).json({ error: 'Cliente nao encontrado' });
    const service = CHEVLA_SERVICES[plan_type];
    if (!service) return res.status(400).json({ error: 'Tipo de plano invalido' });
    const disc = Math.max(0, Math.min(100, parseFloat(discount_percent) || (payment_method === 'pix' ? 5 : 0)));
    const contractNumber = await generateContractNumber();
    const value = service.value;
    const finalValue = value * (1 - disc / 100);
    const result = await db.run(
      `INSERT INTO contracts (client_id,contract_number,contract_type,plan_type,value,payment_method,installments,discount_percent,final_value,start_date,delivery_date,custom_clauses,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [client_id, contractNumber, service.type, plan_type, value, payment_method || null, installments || 1, disc, finalValue, start_date || null, delivery_date || null, custom_clauses || null, notes || null]
    );
    if (['prospect', 'contacted', 'negotiating', 'proposal_sent'].includes(client.status)) {
      await db.run('UPDATE clients SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['client', client_id]);
    }
    const contract = await db.get('SELECT * FROM contracts WHERE id = ?', [result.lastInsertRowid]);
    await db.audit(req.user.id, 'contract', result.lastInsertRowid, 'created', `Contrato ${contractNumber} criado para ${client.company_name}`);
    emitDataChange('contract', 'created', contract, req.user.id);
    res.status(201).json(contract);
  } catch (error) { console.error('Erro ao criar contrato:', error); res.status(500).json({ error: 'Erro interno do servidor' }); }
});

router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID invalido' });
    const existing = await db.get('SELECT * FROM contracts WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Contrato nao encontrado' });
    if (req.body.version !== undefined && existing.version !== undefined && Number(req.body.version) !== existing.version) {
      return res.status(409).json({ error: 'Registro modificado por outro usuario. Recarregue e tente novamente.', conflict: true, serverVersion: existing.version });
    }
    const fields = ['status', 'payment_method', 'installments', 'discount_percent', 'start_date', 'delivery_date', 'custom_clauses', 'notes'];
    const merged = {};
    for (const f of fields) merged[f] = req.body[f] !== undefined ? req.body[f] : existing[f];
    if (merged.discount_percent !== undefined) merged.discount_percent = Math.max(0, Math.min(100, parseFloat(merged.discount_percent) || 0));
    const newFinalValue = existing.value * (1 - (merged.discount_percent || 0) / 100);
    await db.run(
      `UPDATE contracts SET status=?,payment_method=?,installments=?,discount_percent=?,final_value=?,start_date=?,delivery_date=?,custom_clauses=?,notes=?,version=COALESCE(version,0)+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [merged.status, merged.payment_method, merged.installments, merged.discount_percent, newFinalValue, merged.start_date, merged.delivery_date, merged.custom_clauses, merged.notes, id]
    );
    const updated = await db.get('SELECT * FROM contracts WHERE id = ?', [id]);
    await db.audit(req.user.id, 'contract', id, 'updated', `Contrato ${existing.contract_number} atualizado`);
    emitDataChange('contract', 'updated', updated, req.user.id);
    res.json(updated);
  } catch (error) { console.error('Erro ao atualizar contrato:', error); res.status(500).json({ error: 'Erro interno do servidor' }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID invalido' });
    const contract = await db.get('SELECT id, contract_number FROM contracts WHERE id = ?', [id]);
    if (!contract) return res.status(404).json({ error: 'Contrato nao encontrado' });
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas administradores podem excluir contratos' });
    await db.transaction(async (t) => {
      await t.run('DELETE FROM payments WHERE contract_id = ?', [id]);
      await t.run('DELETE FROM contracts WHERE id = ?', [id]);
    });
    await db.audit(req.user.id, 'contract', id, 'deleted', `Contrato ${contract.contract_number} excluido`);
    emitDataChange('contract', 'deleted', { id }, req.user.id);
    res.json({ message: 'Contrato e pagamentos relacionados removidos com sucesso' });
  } catch (error) { console.error('Erro ao excluir contrato:', error); res.status(500).json({ error: 'Erro interno do servidor' }); }
});

// Mount PDF routes on the same router
router.use('/', pdfRouter);

export default router;
