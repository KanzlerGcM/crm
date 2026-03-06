import re

path = r'C:\Users\gabri\Desktop\prospector\server\src\routes\invoices.js'
code = open(path, encoding='utf-8').read()

# 1. Make generateInvoiceNumber async
code = code.replace(
    'function generateInvoiceNumber() {\n  const year = new Date().getFullYear();\n  const prefix = `NF-${year}-`;\n  const last = db.prepare(\n    `SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1`\n  ).get(`NF-${year}%`);\n  let nextNum = 1;\n  if (last?.invoice_number) {\n    const match = last.invoice_number.match(/(\\d+)$/);\n    if (match) nextNum = parseInt(match[1], 10) + 1;\n  }\n  return prefix + String(nextNum).padStart(4, \'0\');\n}',
    'async function generateInvoiceNumber() {\n  const year = new Date().getFullYear();\n  const prefix = `NF-${year}-`;\n  const last = await db.get(\n    `SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1`,\n    [`NF-${year}%`]\n  );\n  let nextNum = 1;\n  if (last?.invoice_number) {\n    const match = last.invoice_number.match(/(\\d+)$/);\n    if (match) nextNum = parseInt(match[1], 10) + 1;\n  }\n  return prefix + String(nextNum).padStart(4, \'0\');\n}'
)

# 2. Make all route handlers async
code = re.sub(r"router\.(get|post|put|delete)\(('[^']+'),\s*\(req, res\) => \{", r"router.\1(\2, async (req, res) => {", code)

# 3. CSV export - simple replace
code = code.replace(
    "    const invoices = db.prepare(`\n      SELECT i.*, c.company_name, c.contact_name\n      FROM invoices i\n      JOIN clients c ON i.client_id = c.id\n      ORDER BY i.created_at DESC\n    `).all();",
    "    const invoices = await db.all(`SELECT i.*, c.company_name, c.contact_name FROM invoices i JOIN clients c ON i.client_id = c.id ORDER BY i.created_at DESC`);"
)

# 4. Stats route
code = code.replace(
    '    const totalRow = db.prepare(\'SELECT COUNT(*) as total FROM invoices\').get();\n    const issuedRow = db.prepare("SELECT COUNT(*) as c FROM invoices WHERE status = \'issued\'").get();\n    const paidRow = db.prepare("SELECT COALESCE(SUM(total),0) as s FROM invoices WHERE status = \'paid\'").get();\n    const pendingRow = db.prepare("SELECT COALESCE(SUM(total),0) as s FROM invoices WHERE status IN (\'issued\',\'overdue\')").get();\n    const overdueRow = db.prepare("SELECT COUNT(*) as c FROM invoices WHERE status = \'overdue\' OR (status = \'issued\' AND due_date < date(\'now\'))").get();',
    '    const [totalRow, issuedRow, paidRow, pendingRow, overdueRow] = await Promise.all([\n      db.get(\'SELECT COUNT(*) as total FROM invoices\'),\n      db.get("SELECT COUNT(*) as c FROM invoices WHERE status = \'issued\'"),\n      db.get("SELECT COALESCE(SUM(total),0) as s FROM invoices WHERE status = \'paid\'"),\n      db.get("SELECT COALESCE(SUM(total),0) as s FROM invoices WHERE status IN (\'issued\',\'overdue\')"),\n      db.get("SELECT COUNT(*) as c FROM invoices WHERE status = \'overdue\' OR (status = \'issued\' AND due_date < CURRENT_DATE)"),\n    ]);'
)

# 5. List route - countQuery.get(), query.all()
code = code.replace(
    "    const total = db.prepare(countQuery).get(...countParams)?.total || 0;\n    query += ` LIMIT ? OFFSET ?`;\n    params.push(limitNum, offset);\n\n    const data = db.prepare(query).all(...params);",
    "    const totalRow2 = await db.get(countQuery, countParams);\n    const total = totalRow2?.total || 0;\n    query += ` LIMIT ? OFFSET ?`;\n    params.push(limitNum, offset);\n\n    const data = await db.all(query, params);"
)

# 6. Get by ID
code = code.replace(
    "    const invoice = db.prepare(`\n      SELECT i.*, c.company_name, c.contact_name, c.email, c.phone, c.cnpj, c.address, c.city, c.state,\n             ct.contract_number\n      FROM invoices i\n      JOIN clients c ON i.client_id = c.id\n      LEFT JOIN contracts ct ON i.contract_id = ct.id\n      WHERE i.id = ?\n    `).get(id);\n    if (!invoice) return res.status(404).json({ error: 'Nota fiscal não encontrada' });\n\n    // Load items\n    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id').all(id);\n    invoice.items = items;",
    "    const invoice = await db.get(`SELECT i.*, c.company_name, c.contact_name, c.email, c.phone, c.cnpj, c.address, c.city, c.state, ct.contract_number FROM invoices i JOIN clients c ON i.client_id = c.id LEFT JOIN contracts ct ON i.contract_id = ct.id WHERE i.id = ?`, [id]);\n    if (!invoice) return res.status(404).json({ error: 'Nota fiscal nao encontrada' });\n    const items = await db.all('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id', [id]);\n    invoice.items = items;"
)

# 7. Create route - replace entire transaction block
old_create_tx = """    const result = db.transaction(() => {
      const inv = db.prepare(`
        INSERT INTO invoices (invoice_number, client_id, contract_id, issue_date, due_date, description,
          subtotal, discount, tax_rate, tax_amount, total, payment_method, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceNumber, client_id, contract_id || null,
        issue_date || new Date().toISOString().split('T')[0],
        due_date || null, description || null,
        subtotal, disc, tax, taxAmount, total,
        payment_method || null, notes || null, req.user.id
      );

      const invoiceId = inv.lastInsertRowid;
      for (const item of items) {
        const itemTotal = (item.quantity || 1) * (item.unit_price || 0);
        db.prepare('INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?)')
          .run(invoiceId, item.description, item.quantity || 1, item.unit_price || 0, Math.round(itemTotal * 100) / 100);
      }

      return invoiceId;
    });

    const created = db.prepare('SELECT * FROM invoices WHERE id = ?').get(result);
    created.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(result);
    db.audit(req.user.id, 'invoice', result, 'created', `Nota fiscal ${invoiceNumber} criada para ${client.company_name}`);"""

new_create_tx = """    const invoiceId = await db.transaction(async (t) => {
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
    await db.audit(req.user.id, 'invoice', invoiceId, 'created', `Nota fiscal ${invoiceNumber} criada para ${client.company_name}`);"""

code = code.replace(old_create_tx, new_create_tx)

# Fix emitDataChange after create (uses old `result`)
code = code.replace(
    '    emitDataChange(\'invoice\', \'created\', created, req.user.id);',
    '    emitDataChange(\'invoice\', \'created\', created, req.user.id);',
    1
)

# 8. Update route - get existing
code = code.replace(
    "    const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);\n    if (!existing) return res.status(404).json({ error: 'Nota fiscal não encontrada' });",
    "    const existing = await db.get('SELECT * FROM invoices WHERE id = ?', [id]);\n    if (!existing) return res.status(404).json({ error: 'Nota fiscal nao encontrada' });"
)

# 9. Update route - transaction block
old_update_tx = """    db.transaction(() => {
      // If items are provided, recalculate
      if (items && items.length > 0) {
        const { subtotal, taxAmount, total } = recalcTotals(items, newDisc, newTax);

        db.prepare(`UPDATE invoices SET status=?, due_date=?, description=?, subtotal=?, discount=?, tax_rate=?,
          tax_amount=?, total=?, payment_method=?, paid_date=?, notes=?,
          version=COALESCE(version,0)+1, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
          .run(newStatus, newDue, newDesc, subtotal, newDisc, newTax, taxAmount, total,
            newPayMethod, newPaidDate, newNotes, id);

        // Replace items
        db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(id);
        for (const item of items) {
          const itemTotal = (item.quantity || 1) * (item.unit_price || 0);
          db.prepare('INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?)')
            .run(id, item.description, item.quantity || 1, item.unit_price || 0, Math.round(itemTotal * 100) / 100);
        }
      } else {
        // Status-only or field updates
        db.prepare(`UPDATE invoices SET status=?, due_date=?, description=?, discount=?, tax_rate=?,
          payment_method=?, paid_date=?, notes=?,
          version=COALESCE(version,0)+1, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
          .run(newStatus, newDue, newDesc, newDisc, newTax, newPayMethod, newPaidDate, newNotes, id);
      }

      // If marking as paid, auto-set paid_date
      if (newStatus === 'paid' && !newPaidDate) {
        db.prepare('UPDATE invoices SET paid_date = date(?) WHERE id = ?').run(new Date().toISOString(), id);
      }
    });

    const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    updated.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(id);
    db.audit(req.user.id, 'invoice', id, 'updated', `Nota fiscal ${existing.invoice_number} atualizada`);"""

new_update_tx = """    await db.transaction(async (t) => {
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
    await db.audit(req.user.id, 'invoice', id, 'updated', `Nota fiscal ${existing.invoice_number} atualizada`);"""

code = code.replace(old_update_tx, new_update_tx)

# 10. Delete route - get invoice, transaction, audit
code = code.replace(
    "    const invoice = db.prepare('SELECT id, invoice_number FROM invoices WHERE id = ?').get(id);\n    if (!invoice) return res.status(404).json({ error: 'Nota fiscal não encontrada' });\n\n    if (req.user.role !== 'admin') {\n      return res.status(403).json({ error: 'Apenas administradores podem excluir notas fiscais' });\n    }\n\n    db.transaction(() => {\n      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(id);\n      db.prepare('DELETE FROM invoices WHERE id = ?').run(id);\n    });\n\n    db.audit(req.user.id, 'invoice', id, 'deleted', `Nota fiscal ${invoice.invoice_number} excluída`);",
    "    const invoice = await db.get('SELECT id, invoice_number FROM invoices WHERE id = ?', [id]);\n    if (!invoice) return res.status(404).json({ error: 'Nota fiscal nao encontrada' });\n    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas administradores podem excluir notas fiscais' });\n    await db.transaction(async (t) => {\n      await t.run('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);\n      await t.run('DELETE FROM invoices WHERE id = ?', [id]);\n    });\n    await db.audit(req.user.id, 'invoice', id, 'deleted', `Nota fiscal ${invoice.invoice_number} excluida`);"
)

# 11. PDF route - db queries
code = code.replace(
    "    const invoice = db.prepare(`\n      SELECT i.*, c.company_name, c.contact_name, c.email, c.phone, c.cnpj, c.address, c.city, c.state,\n             ct.contract_number\n      FROM invoices i\n      JOIN clients c ON i.client_id = c.id\n      LEFT JOIN contracts ct ON i.contract_id = ct.id\n      WHERE i.id = ?\n    `).get(id);\n    if (!invoice) return res.status(404).json({ error: 'Nota fiscal não encontrada' });\n\n    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id').all(id);",
    "    const invoice = await db.get(`SELECT i.*, c.company_name, c.contact_name, c.email, c.phone, c.cnpj, c.address, c.city, c.state, ct.contract_number FROM invoices i JOIN clients c ON i.client_id = c.id LEFT JOIN contracts ct ON i.contract_id = ct.id WHERE i.id = ?`, [id]);\n    if (!invoice) return res.status(404).json({ error: 'Nota fiscal nao encontrada' });\n    const items = await db.all('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id', [id]);"
)

# Fix client get in create route
code = code.replace(
    "    const client = db.prepare('SELECT id, company_name FROM clients WHERE id = ?').get(client_id);\n    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });",
    "    const client = await db.get('SELECT id, company_name FROM clients WHERE id = ?', [client_id]);\n    if (!client) return res.status(404).json({ error: 'Cliente nao encontrado' });"
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)

remaining = code.count('db.prepare')
print(f'invoices.js: {len(open(path, encoding="utf-8").readlines())} lines, db.prepare remaining: {remaining}')
