// ═══════════════════════════════════════
// Invoice (Nota Fiscal) CRUD Routes
// ═══════════════════════════════════════
import { Router } from 'express';
import PDFDocument from 'pdfkit';
import db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';
import { emitDataChange } from '../socket.js';
import {
  CHEVLA_BLUE, CHEVLA_DARK, CHEVLA_GRAY, CHEVLA_LIGHT,
  CHEVLA_CNPJ, CHEVLA_EMAIL, CHEVLA_PHONE, CHEVLA_ADDRESS,
  createPdfHelpers, addPageNumbers,
} from './contracts-shared.js';

const router = Router();
router.use(authMiddleware);

// ── Helpers ──

async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const prefix = `NF-${year}-`;
  const last = await db.get(
    `SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1`,
    [`NF-${year}%`]
  );
  let nextNum = 1;
  if (last?.invoice_number) {
    const match = last.invoice_number.match(/(\d+)$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  return prefix + String(nextNum).padStart(4, '0');
}

function recalcTotals(items, discount = 0, taxRate = 0) {
  const subtotal = items.reduce((sum, it) => sum + (it.quantity || 1) * (it.unit_price || 0), 0);
  const afterDiscount = subtotal - (discount || 0);
  const taxAmount = afterDiscount * ((taxRate || 0) / 100);
  const total = afterDiscount + taxAmount;
  return { subtotal: Math.round(subtotal * 100) / 100, taxAmount: Math.round(taxAmount * 100) / 100, total: Math.round(total * 100) / 100 };
}

const STATUS_MAP = {
  draft: 'Rascunho',
  issued: 'Emitida',
  paid: 'Paga',
  cancelled: 'Cancelada',
  overdue: 'Vencida',
};

// ── CSV export (must be before /:id) ──

router.get('/export/csv', async (req, res) => {
  try {
    const invoices = await db.all(`SELECT i.*, c.company_name, c.contact_name FROM invoices i JOIN clients c ON i.client_id = c.id ORDER BY i.created_at DESC`);
    const header = 'Número;Empresa;Contato;Emissão;Vencimento;Subtotal;Desconto;Imposto;Total;Status;Método Pgto;Pago em\n';
    const rows = invoices.map(inv => [
      inv.invoice_number,
      `"${(inv.company_name || '').replace(/"/g, '""')}"`,
      `"${(inv.contact_name || '').replace(/"/g, '""')}"`,
      inv.issue_date || '',
      inv.due_date || '',
      inv.subtotal,
      inv.discount,
      inv.tax_amount,
      inv.total,
      STATUS_MAP[inv.status] || inv.status,
      inv.payment_method || '',
      inv.paid_date || '',
    ].join(';')).join('\n');
    const bom = '\uFEFF';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=notas-fiscais-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(bom + header + rows);
  } catch (error) {
    console.error('Erro ao exportar notas fiscais CSV:', error);
    res.status(500).json({ error: 'Erro ao exportar' });
  }
});

// ── Stats ──

router.get('/stats', async (req, res) => {
  try {
    const [totalRow, issuedRow, paidRow, pendingRow, overdueRow] = await Promise.all([
      db.get('SELECT COUNT(*) as total FROM invoices'),
      db.get("SELECT COUNT(*) as c FROM invoices WHERE status = 'issued'"),
      db.get("SELECT COALESCE(SUM(total),0) as s FROM invoices WHERE status = 'paid'"),
      db.get("SELECT COALESCE(SUM(total),0) as s FROM invoices WHERE status IN ('issued','overdue')"),
      db.get("SELECT COUNT(*) as c FROM invoices WHERE status = 'overdue' OR (status = 'issued' AND due_date < CURRENT_DATE)"),
    ]);
    res.json({
      total: totalRow?.total || 0,
      issued: issuedRow?.c || 0,
      totalPaid: paidRow?.s || 0,
      totalPending: pendingRow?.s || 0,
      overdue: overdueRow?.c || 0,
    });
  } catch (error) {
    console.error('Erro ao buscar stats de notas fiscais:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ── List ──

router.get('/', async (req, res) => {
  try {
    const { status, client_id, search, page, limit } = req.query;
    let query = `SELECT i.*, c.company_name, c.contact_name, ct.contract_number
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      LEFT JOIN contracts ct ON i.contract_id = ct.id
      WHERE 1=1`;
    let countQuery = `SELECT COUNT(*) as total FROM invoices i JOIN clients c ON i.client_id = c.id WHERE 1=1`;
    const params = [];
    const countParams = [];

    if (status) {
      query += ' AND i.status = ?'; countQuery += ' AND i.status = ?';
      params.push(status); countParams.push(status);
    }
    if (client_id) {
      query += ' AND i.client_id = ?'; countQuery += ' AND i.client_id = ?';
      params.push(client_id); countParams.push(client_id);
    }
    if (search) {
      query += ' AND (i.invoice_number LIKE ? OR c.company_name LIKE ? OR i.description LIKE ?)';
      countQuery += ' AND (i.invoice_number LIKE ? OR c.company_name LIKE ? OR i.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY i.created_at DESC';

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;
    const totalRow2 = await db.get(countQuery, countParams);
    const total = totalRow2?.total || 0;
    query += ` LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);

    const data = await db.all(query, params);
    res.json({ data, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
  } catch (error) {
    console.error('Erro ao listar notas fiscais:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ── Get by ID ──

router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
    const invoice = await db.get(`SELECT i.*, c.company_name, c.contact_name, c.email, c.phone, c.cnpj, c.address, c.city, c.state, ct.contract_number FROM invoices i JOIN clients c ON i.client_id = c.id LEFT JOIN contracts ct ON i.contract_id = ct.id WHERE i.id = ?`, [id]);
    if (!invoice) return res.status(404).json({ error: 'Nota fiscal nao encontrada' });
    const items = await db.all('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id', [id]);
    invoice.items = items;

    res.json(invoice);
  } catch (error) {
    console.error('Erro ao buscar nota fiscal:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ── Create ──

router.post('/', async (req, res) => {
  try {
    const { client_id, contract_id, issue_date, due_date, description, discount, tax_rate, payment_method, notes, items } = req.body;
    if (!client_id) return res.status(400).json({ error: 'Cliente é obrigatório' });
    if (!items || !items.length) return res.status(400).json({ error: 'Adicione ao menos um item' });

    const client = await db.get('SELECT id, company_name FROM clients WHERE id = ?', [client_id]);
    if (!client) return res.status(404).json({ error: 'Cliente nao encontrado' });

    const invoiceNumber = generateInvoiceNumber();
    const disc = Math.max(0, parseFloat(discount) || 0);
    const tax = Math.max(0, parseFloat(tax_rate) || 0);
    const { subtotal, taxAmount, total } = recalcTotals(items, disc, tax);

    const invoiceId = await db.transaction(async (t) => {
      const inv = await t.run(
        `INSERT INTO invoices (invoice_number, client_id, contract_id, issue_date, due_date, description, subtotal, discount, tax_rate, tax_amount, total, payment_method, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [invoiceNumber, client_id, contract_id || null, issue_date || new Date().toISOString().split('T')[0], due_date || null, description || null, subtotal, disc, tax, taxAmount, total, payment_method || null, notes || null, req.user.id]
      );
      const iid = inv.lastInsertRowid;
      for (const item of items) {
        const itemTotal = (item.quantity || 1) * (item.unit_price || 0);
        await t.run('INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?)',
          [iid, item.description, item.quantity || 1, item.unit_price || 0, Math.round(itemTotal * 100) / 100]);
      }
      return iid;
    });

    const created = await db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    created.items = await db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
    await db.audit(req.user.id, 'invoice', invoiceId, 'created', `Nota fiscal ${invoiceNumber} criada para ${client.company_name}`);
    emitDataChange('invoice', 'created', created, req.user.id);
    res.status(201).json(created);
  } catch (error) {
    console.error('Erro ao criar nota fiscal:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ── Update ──

router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
    const existing = await db.get('SELECT * FROM invoices WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Nota fiscal nao encontrada' });

    // Optimistic locking
    if (req.body.version !== undefined && existing.version !== undefined) {
      if (Number(req.body.version) !== existing.version) {
        return res.status(409).json({ error: 'Este registro foi modificado por outro usuário. Recarregue e tente novamente.', conflict: true, serverVersion: existing.version });
      }
    }

    const { status, due_date, description, discount, tax_rate, payment_method, paid_date, notes, items } = req.body;

    const newStatus = status !== undefined ? status : existing.status;
    const newDue = due_date !== undefined ? due_date : existing.due_date;
    const newDesc = description !== undefined ? description : existing.description;
    const newDisc = discount !== undefined ? Math.max(0, parseFloat(discount) || 0) : existing.discount;
    const newTax = tax_rate !== undefined ? Math.max(0, parseFloat(tax_rate) || 0) : existing.tax_rate;
    const newPayMethod = payment_method !== undefined ? payment_method : existing.payment_method;
    const newPaidDate = paid_date !== undefined ? paid_date : existing.paid_date;
    const newNotes = notes !== undefined ? notes : existing.notes;

    await db.transaction(async (t) => {
      if (items && items.length > 0) {
        const { subtotal, taxAmount, total } = recalcTotals(items, newDisc, newTax);
        await t.run(`UPDATE invoices SET status=?,due_date=?,description=?,subtotal=?,discount=?,tax_rate=?,tax_amount=?,total=?,payment_method=?,paid_date=?,notes=?,version=COALESCE(version,0)+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
          [newStatus, newDue, newDesc, subtotal, newDisc, newTax, taxAmount, total, newPayMethod, newPaidDate, newNotes, id]);
        await t.run('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);
        for (const item of items) {
          const itemTotal = (item.quantity || 1) * (item.unit_price || 0);
          await t.run('INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?)',
            [id, item.description, item.quantity || 1, item.unit_price || 0, Math.round(itemTotal * 100) / 100]);
        }
      } else {
        await t.run(`UPDATE invoices SET status=?,due_date=?,description=?,discount=?,tax_rate=?,payment_method=?,paid_date=?,notes=?,version=COALESCE(version,0)+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
          [newStatus, newDue, newDesc, newDisc, newTax, newPayMethod, newPaidDate, newNotes, id]);
      }
      if (newStatus === 'paid' && !newPaidDate) {
        await t.run('UPDATE invoices SET paid_date = CURRENT_DATE WHERE id = ?', [id]);
      }
    });

    const updated = await db.get('SELECT * FROM invoices WHERE id = ?', [id]);
    updated.items = await db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [id]);
    await db.audit(req.user.id, 'invoice', id, 'updated', `Nota fiscal ${existing.invoice_number} atualizada`);
    emitDataChange('invoice', 'updated', updated, req.user.id);
    res.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar nota fiscal:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ── Delete ──

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
    const invoice = await db.get('SELECT id, invoice_number FROM invoices WHERE id = ?', [id]);
    if (!invoice) return res.status(404).json({ error: 'Nota fiscal nao encontrada' });
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas administradores podem excluir notas fiscais' });
    await db.transaction(async (t) => {
      await t.run('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);
      await t.run('DELETE FROM invoices WHERE id = ?', [id]);
    });
    await db.audit(req.user.id, 'invoice', id, 'deleted', `Nota fiscal ${invoice.invoice_number} excluida`);
    emitDataChange('invoice', 'deleted', { id }, req.user.id);
    res.json({ message: 'Nota fiscal removida com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir nota fiscal:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ── PDF Generation ──

router.get('/:id/pdf', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
    const invoice = await db.get(`SELECT i.*, c.company_name, c.contact_name, c.email, c.phone, c.cnpj, c.address, c.city, c.state, ct.contract_number FROM invoices i JOIN clients c ON i.client_id = c.id LEFT JOIN contracts ct ON i.contract_id = ct.id WHERE i.id = ?`, [id]);
    if (!invoice) return res.status(404).json({ error: 'Nota fiscal nao encontrada' });
    const items = await db.all('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id', [id]);

    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 60, left: 55, right: 55 }, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=nota-fiscal-${invoice.invoice_number}.pdf`);
    doc.pipe(res);

    const h = createPdfHelpers(doc);

    h.drawHeader();
    h.drawGradientBar(100);
    doc.y = 124;

    // Title
    doc.fontSize(20).font('Helvetica-Bold').fillColor(CHEVLA_DARK)
      .text('NOTA FISCAL DE SERVIÇOS', 55, doc.y, { align: 'center', width: 485 });
    doc.moveDown(0.4);
    doc.fontSize(13).font('Helvetica').fillColor(CHEVLA_BLUE)
      .text(`Nº ${invoice.invoice_number}`, { align: 'center', width: 485 });
    doc.moveDown(1.2);

    // Emitente
    h.sectionTitle('1', 'EMITENTE');
    h.boldText('Chevla — Desenvolvimento Web e Consultoria Digital');
    if (CHEVLA_CNPJ) h.smallText(`CNPJ: ${CHEVLA_CNPJ}`);
    h.smallText(`E-mail: ${CHEVLA_EMAIL} | Telefone: ${CHEVLA_PHONE}`);
    h.smallText(`Endereço: ${CHEVLA_ADDRESS}`);
    doc.moveDown(0.6);

    // Destinatário
    h.sectionTitle('2', 'DESTINATÁRIO');
    h.boldText(invoice.company_name);
    h.bodyText(`Responsável: ${invoice.contact_name}`);
    if (invoice.cnpj) h.smallText(`CNPJ: ${invoice.cnpj}`);
    if (invoice.email) h.smallText(`E-mail: ${invoice.email}`);
    if (invoice.phone) h.smallText(`Telefone: ${invoice.phone}`);
    if (invoice.address) {
      let addr = invoice.address;
      if (invoice.city) addr += ` - ${invoice.city}`;
      if (invoice.state) addr += `/${invoice.state}`;
      h.smallText(`Endereço: ${addr}`);
    }
    doc.moveDown(0.6);

    // Dados da nota
    h.sectionTitle('3', 'DADOS DA NOTA');
    const fmt = h.formatCurrency;
    h.bodyText(`Data de Emissão: ${formatDateBR(invoice.issue_date)}`);
    if (invoice.due_date) h.bodyText(`Data de Vencimento: ${formatDateBR(invoice.due_date)}`);
    h.bodyText(`Status: ${STATUS_MAP[invoice.status] || invoice.status}`);
    if (invoice.payment_method) h.bodyText(`Método de Pagamento: ${invoice.payment_method}`);
    if (invoice.paid_date) h.bodyText(`Pago em: ${formatDateBR(invoice.paid_date)}`);
    if (invoice.contract_number) h.bodyText(`Contrato: ${invoice.contract_number}`);
    if (invoice.description) { doc.moveDown(0.3); h.bodyText(invoice.description); }
    doc.moveDown(0.6);

    // Items table
    h.sectionTitle('4', 'ITENS');
    h.checkPageSpace(80);

    // Table header
    const tableTop = doc.y;
    const colX = { desc: 55, qty: 340, price: 400, total: 470 };

    doc.rect(55, tableTop, 485, 22).fill(CHEVLA_BLUE);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#FFFFFF');
    doc.text('Descrição', colX.desc + 8, tableTop + 6, { width: 270 });
    doc.text('Qtd', colX.qty, tableTop + 6, { width: 50, align: 'center' });
    doc.text('Unitário', colX.price, tableTop + 6, { width: 65, align: 'right' });
    doc.text('Total', colX.total, tableTop + 6, { width: 65, align: 'right' });

    let rowY = tableTop + 24;
    items.forEach((item, idx) => {
      h.checkPageSpace(30);
      if (idx % 2 === 0) doc.rect(55, rowY, 485, 20).fill('#F8FAFC');
      else doc.rect(55, rowY, 485, 20).fill('#FFFFFF');
      doc.fontSize(10).font('Helvetica').fillColor(CHEVLA_DARK);
      doc.text(item.description || '', colX.desc + 8, rowY + 5, { width: 270, lineBreak: false });
      doc.text(String(item.quantity || 1), colX.qty, rowY + 5, { width: 50, align: 'center' });
      doc.text(fmt(item.unit_price || 0), colX.price, rowY + 5, { width: 65, align: 'right' });
      doc.text(fmt(item.total || 0), colX.total, rowY + 5, { width: 65, align: 'right' });
      rowY += 20;
    });

    // Divider line
    doc.strokeColor(CHEVLA_BLUE).lineWidth(0.5);
    doc.moveTo(55, rowY).lineTo(540, rowY).stroke();
    rowY += 8;

    // Totals
    doc.y = rowY;
    const rightX = 400;
    doc.fontSize(11).font('Helvetica').fillColor(CHEVLA_DARK);
    doc.text('Subtotal:', rightX, doc.y, { width: 70 });
    doc.text(fmt(invoice.subtotal), rightX + 70, doc.y - doc.currentLineHeight(), { width: 65, align: 'right' });
    doc.moveDown(0.3);
    if (invoice.discount > 0) {
      doc.text('Desconto:', rightX, doc.y, { width: 70 });
      doc.text(`- ${fmt(invoice.discount)}`, rightX + 70, doc.y - doc.currentLineHeight(), { width: 65, align: 'right' });
      doc.moveDown(0.3);
    }
    if (invoice.tax_rate > 0) {
      doc.text(`Imposto (${invoice.tax_rate}%):`, rightX, doc.y, { width: 70 });
      doc.text(fmt(invoice.tax_amount), rightX + 70, doc.y - doc.currentLineHeight(), { width: 65, align: 'right' });
      doc.moveDown(0.3);
    }
    doc.moveDown(0.2);
    doc.fontSize(14).font('Helvetica-Bold').fillColor(CHEVLA_BLUE);
    doc.text('TOTAL:', rightX, doc.y, { width: 70 });
    doc.text(fmt(invoice.total), rightX + 70, doc.y - doc.currentLineHeight(), { width: 65, align: 'right' });
    doc.moveDown(1.5);

    // Notes
    if (invoice.notes) {
      h.sectionTitle('5', 'OBSERVAÇÕES');
      h.bodyText(invoice.notes);
      doc.moveDown(1);
    }

    // Watermark for cancelled
    const watermark = invoice.status === 'cancelled' ? 'CANCELADA' : null;

    // Finalize
    addPageNumbers(doc);
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      h.drawFooter();
      if (watermark) h.drawWatermark(watermark);
    }
    doc.end();
  } catch (error) {
    console.error('Erro ao gerar PDF da nota fiscal:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Erro ao gerar PDF' });
  }
});

// ── Helper: format date as DD/MM/YYYY ──
function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export default router;
