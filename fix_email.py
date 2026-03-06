import re

path = r'C:\Users\gabri\Desktop\prospector\server\src\routes\email.js'
code = open(path, encoding='utf-8').read()

# 1. Make ensureCacheTable async
code = code.replace(
    "let _cacheTableReady = false;\nfunction ensureCacheTable() {\n  if (_cacheTableReady) return;\n  try {\n    db.prepare(`CREATE TABLE IF NOT EXISTS email_cache (\n      uid INTEGER PRIMARY KEY,\n      folder TEXT DEFAULT 'INBOX',\n      from_raw TEXT, from_address TEXT, to_raw TEXT, subject TEXT,\n      date TEXT, flags TEXT, has_attachments INTEGER DEFAULT 0,\n      seen INTEGER DEFAULT 0, cached_at TEXT DEFAULT CURRENT_TIMESTAMP\n    )`).run();\n    try { db.prepare('CREATE INDEX IF NOT EXISTS idx_email_cache_folder ON email_cache(folder, date DESC)').run(); } catch {}\n    _cacheTableReady = true;\n  } catch (e) { /* DB not ready yet — will retry on next call */ }\n}",
    "let _cacheTableReady = false;\nasync function ensureCacheTable() {\n  if (_cacheTableReady) return;\n  try {\n    await db.run(`CREATE TABLE IF NOT EXISTS email_cache (\n      uid INTEGER PRIMARY KEY,\n      folder TEXT DEFAULT 'INBOX',\n      from_raw TEXT, from_address TEXT, to_raw TEXT, subject TEXT,\n      date TEXT, flags TEXT, has_attachments INTEGER DEFAULT 0,\n      seen INTEGER DEFAULT 0, cached_at TEXT DEFAULT CURRENT_TIMESTAMP\n    )`);\n    try { await db.run('CREATE INDEX IF NOT EXISTS idx_email_cache_folder ON email_cache(folder, date DESC)'); } catch {}\n    _cacheTableReady = true;\n  } catch (e) { /* DB not ready yet — will retry on next call */ }\n}"
)

# 2. Make getEmailConfig async
code = code.replace(
    "function getEmailConfig() {\n  const settings = db.prepare('SELECT * FROM email_settings WHERE id = 1').get();\n  if (!settings) return null;",
    "async function getEmailConfig() {\n  const settings = await db.get('SELECT * FROM email_settings WHERE id = 1');\n  if (!settings) return null;"
)

# 3. POST /settings - make async and fix db calls
code = code.replace(
    "router.post('/settings', adminOnly, async (req, res) => {\n  try {\n    const { smtp_host, smtp_port, imap_host, imap_port, email_address, email_password, from_name } = req.body;\n    if (!smtp_host || !email_address || !email_password) {\n      return res.status(400).json({ error: 'Host SMTP, e-mail e senha são obrigatórios' });\n    }\n\n    const existing = db.prepare('SELECT id FROM email_settings WHERE id = 1').get();\n    const encPass = encrypt(email_password);\n    if (existing) {\n      db.prepare(`UPDATE email_settings SET smtp_host=?, smtp_port=?, imap_host=?, imap_port=?, email_address=?, email_password=?, from_name=?, updated_at=CURRENT_TIMESTAMP WHERE id=1`).run(\n        smtp_host, smtp_port || 587, imap_host || smtp_host.replace('smtp', 'imap'), imap_port || 993, email_address, encPass, from_name || 'Chevla'\n      );\n    } else {\n      db.prepare(`INSERT INTO email_settings (id, smtp_host, smtp_port, imap_host, imap_port, email_address, email_password, from_name) VALUES (1, ?, ?, ?, ?, ?, ?, ?)`).run(\n        smtp_host, smtp_port || 587, imap_host || smtp_host.replace('smtp', 'imap'), imap_port || 993, email_address, encPass, from_name || 'Chevla'\n      );\n    }\n\n    res.json({ message: 'Configurações salvas com sucesso' });",
    "router.post('/settings', adminOnly, async (req, res) => {\n  try {\n    const { smtp_host, smtp_port, imap_host, imap_port, email_address, email_password, from_name } = req.body;\n    if (!smtp_host || !email_address || !email_password) {\n      return res.status(400).json({ error: 'Host SMTP, e-mail e senha sao obrigatorios' });\n    }\n    const existing = await db.get('SELECT id FROM email_settings WHERE id = 1');\n    const encPass = encrypt(email_password);\n    if (existing) {\n      await db.run(`UPDATE email_settings SET smtp_host=?,smtp_port=?,imap_host=?,imap_port=?,email_address=?,email_password=?,from_name=?,updated_at=CURRENT_TIMESTAMP WHERE id=1`,\n        [smtp_host, smtp_port || 587, imap_host || smtp_host.replace('smtp', 'imap'), imap_port || 993, email_address, encPass, from_name || 'Chevla']);\n    } else {\n      await db.run(`INSERT INTO email_settings (id,smtp_host,smtp_port,imap_host,imap_port,email_address,email_password,from_name) VALUES (1,?,?,?,?,?,?,?)`,\n        [smtp_host, smtp_port || 587, imap_host || smtp_host.replace('smtp', 'imap'), imap_port || 993, email_address, encPass, from_name || 'Chevla']);\n    }\n    res.json({ message: 'Configuracoes salvas com sucesso' });"
)

# 4. GET /settings settings
code = code.replace(
    "router.get('/settings', adminOnly, (req, res) => {\n  try {\n    const settings = db.prepare('SELECT smtp_host, smtp_port, imap_host, imap_port, email_address, from_name FROM email_settings WHERE id = 1').get();\n    res.json(settings || {});",
    "router.get('/settings', adminOnly, async (req, res) => {\n  try {\n    const settings = await db.get('SELECT smtp_host, smtp_port, imap_host, imap_port, email_address, from_name FROM email_settings WHERE id = 1');\n    res.json(settings || {});"
)

# 5. POST /test - already async, fix getEmailConfig call
code = code.replace(
    "    const config = getEmailConfig();\n    if (!config) return res.status(400).json({ error: 'Configure o e-mail primeiro em Configurações' });\n\n    const transporter = createTransporter(config);\n    await transporter.verify();",
    "    const config = await getEmailConfig();\n    if (!config) return res.status(400).json({ error: 'Configure o e-mail primeiro em Configuracoes' });\n    const transporter = createTransporter(config);\n    await transporter.verify();"
)

# 6. POST /send - fix getEmailConfig + db calls
code = code.replace(
    "  try {\n    const config = getEmailConfig();\n    if (!config) return res.status(400).json({ error: 'Configure o e-mail primeiro em Configurações' });\n\n    const { to, subject, body, html, client_id } = req.body;\n    if (!to || !subject) return res.status(400).json({ error: 'Destinatário e assunto são obrigatórios' });\n\n    const transporter = createTransporter(config);\n    const mailOptions = {\n      from: `\"${config.from_name}\" <${config.email}>`,\n      to,\n      subject,\n      text: body || '',\n      html: html || body || '',\n    };\n\n    const info = await transporter.sendMail(mailOptions);\n\n    // Salvar no banco (emails_sent)\n    db.prepare(`INSERT INTO emails_sent (to_address, subject, body, message_id, client_id) VALUES (?, ?, ?, ?, ?)`).run(\n      to, subject, body || html || '', info.messageId, client_id || null\n    );\n\n    // Se tiver client_id, registrar interação\n    if (client_id) {\n      db.prepare(`INSERT INTO interactions (client_id, user_id, type, description) VALUES (?, ?, 'email', ?)`).run(\n        client_id, req.user.id, `E-mail enviado: \"${subject}\" para ${to}`\n      );\n    }",
    "  try {\n    const config = await getEmailConfig();\n    if (!config) return res.status(400).json({ error: 'Configure o e-mail primeiro em Configuracoes' });\n    const { to, subject, body, html, client_id } = req.body;\n    if (!to || !subject) return res.status(400).json({ error: 'Destinatario e assunto sao obrigatorios' });\n    const transporter = createTransporter(config);\n    const mailOptions = { from: `\"${config.from_name}\" <${config.email}>`, to, subject, text: body || '', html: html || body || '' };\n    const info = await transporter.sendMail(mailOptions);\n    await db.run(`INSERT INTO emails_sent (to_address, subject, body, message_id, client_id) VALUES (?, ?, ?, ?, ?)`,\n      [to, subject, body || html || '', info.messageId, client_id || null]);\n    if (client_id) {\n      await db.run(`INSERT INTO interactions (client_id, user_id, type, description) VALUES (?, ?, 'email', ?)`,\n        [client_id, req.user.id, `E-mail enviado: \"${subject}\" para ${to}`]);\n    }"
)

# 7. generateContractPdf - fix db.prepare().get()
code = code.replace(
    "      const contract = db.prepare(`\n        SELECT c.*, cl.company_name as client_name, cl.contact_name, cl.email as client_email, cl.phone as client_phone, cl.address, cl.city, cl.state, cl.cnpj\n        FROM contracts c\n        LEFT JOIN clients cl ON c.client_id = cl.id\n        WHERE c.id = ?\n      `).get(contractId);\n      if (!contract) return reject(new Error('Contrato não encontrado'));",
    "      const contract = await db.get(`SELECT c.*, cl.company_name as client_name, cl.contact_name, cl.email as client_email, cl.phone as client_phone, cl.address, cl.city, cl.state, cl.cnpj FROM contracts c LEFT JOIN clients cl ON c.client_id = cl.id WHERE c.id = ?`, [contractId]);\n      if (!contract) return reject(new Error('Contrato nao encontrado'));"
)

# Make generateContractPdf outer function async-aware  
code = code.replace(
    "async function generateContractPdf(contractId, type) {\n  return new Promise((resolve, reject) => {\n    try {",
    "async function generateContractPdf(contractId, type) {\n  return new Promise(async (resolve, reject) => {\n    try {"
)

# 8. POST /send-with-attachments - fix getEmailConfig + db calls
code = code.replace(
    "  try {\n    const config = getEmailConfig();\n    if (!config) return res.status(400).json({ error: 'Configure o e-mail primeiro em Configurações' });\n\n    const { to, subject, body, client_id, contractAttachments } = req.body;\n    if (!to || !subject) return res.status(400).json({ error: 'Destinatário e assunto são obrigatórios' });",
    "  try {\n    const config = await getEmailConfig();\n    if (!config) return res.status(400).json({ error: 'Configure o e-mail primeiro em Configuracoes' });\n    const { to, subject, body, client_id, contractAttachments } = req.body;\n    if (!to || !subject) return res.status(400).json({ error: 'Destinatario e assunto sao obrigatorios' });"
)

# Fix db.prepare in send-with-attachments salvar no banco
code = code.replace(
    "    // Salvar no banco\n    db.prepare(`INSERT INTO emails_sent (to_address, subject, body, message_id, client_id) VALUES (?, ?, ?, ?, ?)`).run(\n      to, subject, body || '', info.messageId, client_id || null\n    );\n\n    if (client_id) {\n      const attachDesc = attachments.length > 0 ? ` (${attachments.length} anexo${attachments.length > 1 ? 's' : ''})` : '';\n      db.prepare(`INSERT INTO interactions (client_id, user_id, type, description) VALUES (?, ?, 'email', ?)`).run(\n        client_id, req.user.id, `E-mail enviado: \"${subject}\" para ${to}${attachDesc}`\n      );\n    }",
    "    await db.run(`INSERT INTO emails_sent (to_address, subject, body, message_id, client_id) VALUES (?, ?, ?, ?, ?)`,\n      [to, subject, body || '', info.messageId, client_id || null]);\n    if (client_id) {\n      const attachDesc = attachments.length > 0 ? ` (${attachments.length} anexo${attachments.length > 1 ? 's' : ''})` : '';\n      await db.run(`INSERT INTO interactions (client_id, user_id, type, description) VALUES (?, ?, 'email', ?)`,\n        [client_id, req.user.id, `E-mail enviado: \"${subject}\" para ${to}${attachDesc}`]);\n    }"
)

# 9. GET /inbox route - make async, fix getEmailConfig, ensureCacheTable, db calls
code = code.replace(
    "router.get('/inbox', (req, res) => {\n  try {\n    const config = getEmailConfig();\n    if (!config) return res.status(400).json({ error: 'Configure o e-mail primeiro em Configurações' });",
    "router.get('/inbox', async (req, res) => {\n  try {\n    const config = await getEmailConfig();\n    if (!config) return res.status(400).json({ error: 'Configure o e-mail primeiro em Configuracoes' });"
)

# Fix ensureCacheTable() and db calls in /inbox
code = code.replace(
    "    // 1) Check cache first — respond instantly if cached\n    ensureCacheTable();\n    const cached = db.prepare('SELECT COUNT(*) as cnt FROM email_cache WHERE folder = ?').get('INBOX');\n    if (cached.cnt > 0 && !forceRefresh) {\n      const messages = db.prepare(\n        'SELECT uid, from_raw as \"from\", from_address, to_raw as \"to\", subject, date, seen, has_attachments as hasAttachments FROM email_cache WHERE folder = ? ORDER BY date DESC LIMIT ? OFFSET ?'\n      ).all('INBOX', limit, offset);",
    "    // 1) Check cache first — respond instantly if cached\n    await ensureCacheTable();\n    const cached = await db.get('SELECT COUNT(*) as cnt FROM email_cache WHERE folder = ?', ['INBOX']);\n    if ((cached?.cnt || 0) > 0 && !forceRefresh) {\n      const messages = await db.all(\n        'SELECT uid, from_raw as \"from\", from_address, to_raw as \"to\", subject, date, seen, has_attachments as hasAttachments FROM email_cache WHERE folder = ? ORDER BY date DESC LIMIT ? OFFSET ?',\n        ['INBOX', limit, offset]\n      );"
)

# Fix total in inbox cache block  
code = code.replace(
    "      const total = cached.cnt;",
    "      const total = cached?.cnt || 0;"
)

# 10. Fix IMAP callback db calls in syncInboxBackground (fire and forget)
old_upsert_sync = """          // Upsert into cache
          const upsert = db.prepare(
            `INSERT OR REPLACE INTO email_cache (uid, folder, from_raw, from_address, to_raw, subject, date, seen, cached_at)
             VALUES (?, 'INBOX', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
          );
          for (const e of newEmails) {
            try { upsert.run(e.uid, e.from, e.from_address, e.to, e.subject, e.date, e.seen); } catch {}
          }"""

new_upsert_sync = """          // Upsert into cache (fire and forget)
          for (const e of newEmails) {
            db.run(
              `INSERT INTO email_cache (uid, folder, from_raw, from_address, to_raw, subject, date, seen, cached_at)
               VALUES (?, 'INBOX', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
               ON CONFLICT (uid) DO UPDATE SET from_raw=EXCLUDED.from_raw, subject=EXCLUDED.subject, seen=EXCLUDED.seen, cached_at=EXCLUDED.cached_at`,
              [e.uid, e.from, e.from_address, e.to, e.subject, e.date, e.seen]
            ).catch(() => {});
          }"""

code = code.replace(old_upsert_sync, new_upsert_sync)

# 11. Fix IMAP callback db calls in fetchInboxIMAP (fire and forget)
old_upsert_fetch = """          // Save to cache for next time
          try {
            const upsert = db.prepare(
              `INSERT OR REPLACE INTO email_cache (uid, folder, from_raw, from_address, to_raw, subject, date, seen, cached_at)
               VALUES (?, 'INBOX', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
            );
            for (const e of emails) {
              upsert.run(e.uid, e.from, e.from_address, e.to, e.subject, e.date ? new Date(e.date).toISOString() : null, e.seen ? 1 : 0);
            }
          } catch (cacheErr) { console.error('[Email] cache save error:', cacheErr.message); }"""

new_upsert_fetch = """          // Save to cache for next time (fire and forget)
          for (const e of emails) {
            db.run(
              `INSERT INTO email_cache (uid, folder, from_raw, from_address, to_raw, subject, date, seen, cached_at)
               VALUES (?, 'INBOX', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
               ON CONFLICT (uid) DO UPDATE SET from_raw=EXCLUDED.from_raw, subject=EXCLUDED.subject, seen=EXCLUDED.seen, cached_at=EXCLUDED.cached_at`,
              [e.uid, e.from, e.from_address, e.to, e.subject, e.date ? new Date(e.date).toISOString() : null, e.seen ? 1 : 0]
            ).catch(() => {});
          }"""

code = code.replace(old_upsert_fetch, new_upsert_fetch)

# 12. GET /message/:uid - make async, fix getEmailConfig
code = code.replace(
    "router.get('/message/:uid', (req, res) => {\n  try {\n    const config = getEmailConfig();\n    if (!config) return res.status(400).json({ error: 'Configure o e-mail primeiro' });",
    "router.get('/message/:uid', async (req, res) => {\n  try {\n    const config = await getEmailConfig();\n    if (!config) return res.status(400).json({ error: 'Configure o e-mail primeiro' });"
)

# 13. GET /sent - make async, fix db calls
code = code.replace(
    "router.get('/sent', (req, res) => {\n  try {\n    const limit = parseInt(req.query.limit) || 30;\n    const offset = (parseInt(req.query.page) || 0) * limit;\n    const emails = db.prepare(`SELECT es.*, c.company_name, c.contact_name FROM emails_sent es LEFT JOIN clients c ON es.client_id = c.id ORDER BY es.created_at DESC LIMIT ? OFFSET ?`).all(limit, offset);\n    const total = db.prepare('SELECT COUNT(*) as c FROM emails_sent').get();\n    res.json({ messages: emails, total: total?.c || 0 });",
    "router.get('/sent', async (req, res) => {\n  try {\n    const limit = parseInt(req.query.limit) || 30;\n    const offset = (parseInt(req.query.page) || 0) * limit;\n    const [emails, total] = await Promise.all([\n      db.all(`SELECT es.*, c.company_name, c.contact_name FROM emails_sent es LEFT JOIN clients c ON es.client_id = c.id ORDER BY es.created_at DESC LIMIT ? OFFSET ?`, [limit, offset]),\n      db.get('SELECT COUNT(*) as c FROM emails_sent'),\n    ]);\n    res.json({ messages: emails, total: total?.c || 0 });"
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)

remaining = code.count('db.prepare')
print(f'email.js: {len(open(path, encoding="utf-8").readlines())} lines, db.prepare remaining: {remaining}')
