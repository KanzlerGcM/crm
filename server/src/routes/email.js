import { Router } from 'express';
import nodemailer from 'nodemailer';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import db, { encrypt, decrypt } from '../database.js';
import { EMAIL_REJECT_UNAUTHORIZED } from '../config.js';
import { adminOnly } from '../middleware/auth.js';
import PDFDocument from 'pdfkit';

const router = Router();
router.use(authMiddleware);

// Multer memory storage for file uploads
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// ───── SMTP transporter cache ─────
let _cachedTransporter = null;
let _transporterConfigHash = '';

// ───── Email cache in SQLite (lazy init) ─────
let _cacheTableReady = false;
async function ensureCacheTable() {
  if (_cacheTableReady) return;
  try {
    await db.run(`CREATE TABLE IF NOT EXISTS email_cache (
      uid INTEGER PRIMARY KEY,
      folder TEXT DEFAULT 'INBOX',
      from_raw TEXT, from_address TEXT, to_raw TEXT, subject TEXT,
      date TEXT, flags TEXT, has_attachments INTEGER DEFAULT 0,
      seen INTEGER DEFAULT 0, cached_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    try { await db.run('CREATE INDEX IF NOT EXISTS idx_email_cache_folder ON email_cache(folder, date DESC)'); } catch {}
    _cacheTableReady = true;
  } catch (e) { /* DB not ready yet — will retry on next call */ }
}

// ===== HELPER: Pegar config de e-mail do Settings =====
async function getEmailConfig() {
  const settings = await db.get('SELECT * FROM email_settings WHERE id = 1');
  if (!settings) return null;
  return {
    smtp_host: settings.smtp_host,
    smtp_port: settings.smtp_port,
    imap_host: settings.imap_host,
    imap_port: settings.imap_port,
    email: settings.email_address,
    password: decrypt(settings.email_password),
    from_name: settings.from_name || 'Chevla',
  };
}

function createTransporter(config) {
  const hash = `${config.smtp_host}:${config.smtp_port}:${config.email}`;
  if (_cachedTransporter && _transporterConfigHash === hash) return _cachedTransporter;
  _cachedTransporter = nodemailer.createTransport({
    host: config.smtp_host,
    port: config.smtp_port,
    secure: config.smtp_port === 465,
    auth: { user: config.email, pass: config.password },
    tls: { rejectUnauthorized: EMAIL_REJECT_UNAUTHORIZED },
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
  });
  _transporterConfigHash = hash;
  return _cachedTransporter;
}

// ===== SALVAR/ATUALIZAR CONFIGURAÇÃO DE E-MAIL =====
router.post('/settings', adminOnly, async (req, res) => {
  try {
    const { smtp_host, smtp_port, imap_host, imap_port, email_address, email_password, from_name } = req.body;
    if (!smtp_host || !email_address || !email_password) {
      return res.status(400).json({ error: 'Host SMTP, e-mail e senha sao obrigatorios' });
    }
    const existing = await db.get('SELECT id FROM email_settings WHERE id = 1');
    const encPass = encrypt(email_password);
    if (existing) {
      await db.run(`UPDATE email_settings SET smtp_host=?,smtp_port=?,imap_host=?,imap_port=?,email_address=?,email_password=?,from_name=?,updated_at=CURRENT_TIMESTAMP WHERE id=1`,
        [smtp_host, smtp_port || 587, imap_host || smtp_host.replace('smtp', 'imap'), imap_port || 993, email_address, encPass, from_name || 'Chevla']);
    } else {
      await db.run(`INSERT INTO email_settings (id,smtp_host,smtp_port,imap_host,imap_port,email_address,email_password,from_name) VALUES (1,?,?,?,?,?,?,?)`,
        [smtp_host, smtp_port || 587, imap_host || smtp_host.replace('smtp', 'imap'), imap_port || 993, email_address, encPass, from_name || 'Chevla']);
    }
    res.json({ message: 'Configuracoes salvas com sucesso' });
  } catch (error) {
    console.error('Erro ao salvar config de email:', error);
    res.status(500).json({ error: 'Erro ao salvar configurações' });
  }
});

// ===== OBTER CONFIGURAÇÃO DE E-MAIL =====
router.get('/settings', adminOnly, async (req, res) => {
  try {
    const settings = await db.get('SELECT smtp_host, smtp_port, imap_host, imap_port, email_address, from_name FROM email_settings WHERE id = 1');
    res.json(settings || {});
  } catch (error) { res.status(500).json({ error: 'Erro ao buscar configurações' }); }
});

// ===== TESTAR CONEXÃO =====
router.post('/test', async (req, res) => {
  try {
    const config = await getEmailConfig();
    if (!config) return res.status(400).json({ error: 'Configure o e-mail primeiro em Configuracoes' });
    const transporter = createTransporter(config);
    await transporter.verify();
    res.json({ message: 'Conexão SMTP verificada com sucesso!' });
  } catch (error) {
    console.error('Erro ao testar e-mail:', error);
    res.status(400).json({ error: `Falha na conexão: ${error.message}` });
  }
});

// ===== ENVIAR E-MAIL =====
router.post('/send', async (req, res) => {
  try {
    const config = await getEmailConfig();
    if (!config) return res.status(400).json({ error: 'Configure o e-mail primeiro em Configuracoes' });
    const { to, subject, body, html, client_id } = req.body;
    if (!to || !subject) return res.status(400).json({ error: 'Destinatario e assunto sao obrigatorios' });
    const transporter = createTransporter(config);
    const mailOptions = { from: `"${config.from_name}" <${config.email}>`, to, subject, text: body || '', html: html || body || '' };
    const info = await transporter.sendMail(mailOptions);
    await db.run(`INSERT INTO emails_sent (to_address, subject, body, message_id, client_id) VALUES (?, ?, ?, ?, ?)`,
      [to, subject, body || html || '', info.messageId, client_id || null]);
    if (client_id) {
      await db.run(`INSERT INTO interactions (client_id, user_id, type, description) VALUES (?, ?, 'email', ?)`,
        [client_id, req.user.id, `E-mail enviado: "${subject}" para ${to}`]);
    }

    res.json({ message: 'E-mail enviado com sucesso!', messageId: info.messageId });
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    res.status(500).json({ error: `Falha ao enviar: ${error.message}` });
  }
});

// ===== HELPER: Gerar PDF de contrato em memória =====
async function generateContractPdf(contractId, type) {
  return new Promise(async (resolve, reject) => {
    try {
      const contract = await db.get(`SELECT c.*, cl.company_name as client_name, cl.contact_name, cl.email as client_email, cl.phone as client_phone, cl.address, cl.city, cl.state, cl.cnpj FROM contracts c LEFT JOIN clients cl ON c.client_id = cl.id WHERE c.id = ?`, [contractId]);
      if (!contract) return reject(new Error('Contrato nao encontrado'));

      // Map type to filename label
      const typeLabels = {
        pdf: 'Contrato',
        proposal: 'Proposta Comercial',
        acceptance: 'Termo de Aceite',
        addendum: 'Aditivo',
        termination: 'Distrato',
        receipt: 'Recibo',
        briefing: 'Briefing',
      };
      const label = typeLabels[type] || 'Documento';
      const fileName = `${label} - ${contract.client_name || 'Cliente'} #${contractId}.pdf`;

      // Build a simple PDF with the info
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ buffer, fileName });
      });
      doc.on('error', reject);

      doc.fontSize(20).font('Helvetica-Bold').text(`CHEVLA - ${label.toUpperCase()}`, { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(11).font('Helvetica').text(`Contrato #${contractId}`, { align: 'center' });
      doc.moveDown(0.5);
      doc.text(`Cliente: ${contract.client_name || '-'}`, { align: 'center' });
      doc.text(`Contato: ${contract.contact_name || '-'}`, { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(10).font('Helvetica')
        .text(`Data: ${new Date().toLocaleDateString('pt-BR')}`)
        .text(`Tipo: ${label}`)
        .text(`Valor: R$ ${contract.total_value ? Number(contract.total_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}`)
        .text(`Status: ${contract.status || '-'}`);

      if (contract.notes) {
        doc.moveDown(1);
        doc.text('Observações:', { underline: true });
        doc.text(contract.notes);
      }

      doc.moveDown(3);
      doc.fontSize(9).fillColor('#666').text('Documento gerado automaticamente pelo sistema Prospector Chevla.', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ===== ENVIAR E-MAIL COM ANEXOS (FormData) =====
router.post('/send-with-attachments', upload.array('files', 10), async (req, res) => {
  try {
    const config = await getEmailConfig();
    if (!config) return res.status(400).json({ error: 'Configure o e-mail primeiro em Configuracoes' });
    const { to, subject, body, client_id, contractAttachments } = req.body;
    if (!to || !subject) return res.status(400).json({ error: 'Destinatario e assunto sao obrigatorios' });

    const transporter = createTransporter(config);
    const attachments = [];

    // 1. Contract PDFs from the system
    if (contractAttachments) {
      try {
        const contracts = JSON.parse(contractAttachments);
        for (const ca of contracts) {
          try {
            // Try to fetch the PDF from the contracts route internally
            const { buffer, fileName } = await generateContractPdf(ca.id, ca.type);
            attachments.push({
              filename: fileName,
              content: buffer,
              contentType: 'application/pdf',
            });
          } catch (pdfErr) {
            console.error(`Erro ao gerar PDF do contrato ${ca.id}:`, pdfErr.message);
          }
        }
      } catch (parseErr) {
        console.error('Erro ao parsing contractAttachments:', parseErr);
      }
    }

    // 2. Uploaded files from user's computer
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        attachments.push({
          filename: file.originalname,
          content: file.buffer,
          contentType: file.mimetype,
        });
      }
    }

    const mailOptions = {
      from: `"${config.from_name}" <${config.email}>`,
      to,
      subject,
      text: body || '',
      html: body || '',
      attachments,
    };

    const info = await transporter.sendMail(mailOptions);

    await db.run(`INSERT INTO emails_sent (to_address, subject, body, message_id, client_id) VALUES (?, ?, ?, ?, ?)`,
      [to, subject, body || '', info.messageId, client_id || null]);
    if (client_id) {
      const attachDesc = attachments.length > 0 ? ` (${attachments.length} anexo${attachments.length > 1 ? 's' : ''})` : '';
      await db.run(`INSERT INTO interactions (client_id, user_id, type, description) VALUES (?, ?, 'email', ?)`,
        [client_id, req.user.id, `E-mail enviado: "${subject}" para ${to}${attachDesc}`]);
    }

    res.json({ message: 'E-mail enviado com sucesso!', messageId: info.messageId, attachmentsCount: attachments.length });
  } catch (error) {
    console.error('Erro ao enviar e-mail com anexos:', error);
    res.status(500).json({ error: `Falha ao enviar: ${error.message}` });
  }
});

// ===== LISTAR E-MAILS RECEBIDOS (Cache-first + IMAP background sync) =====
router.get('/inbox', async (req, res) => {
  try {
    const config = await getEmailConfig();
    if (!config) return res.status(400).json({ error: 'Configure o e-mail primeiro em Configuracoes' });

    const limit = parseInt(req.query.limit) || 30;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    const forceRefresh = req.query.refresh === '1';

    // 1) Check cache first — respond instantly if cached
    await ensureCacheTable();
    const cached = await db.get('SELECT COUNT(*) as cnt FROM email_cache WHERE folder = ?', ['INBOX']);
    if ((cached?.cnt || 0) > 0 && !forceRefresh) {
      const messages = await db.all(
        'SELECT uid, from_raw as "from", from_address, to_raw as "to", subject, date, seen, has_attachments as hasAttachments FROM email_cache WHERE folder = ? ORDER BY date DESC LIMIT ? OFFSET ?',
        ['INBOX', limit, offset]
      );
      const total = cached?.cnt || 0;

      // Trigger background sync (non-blocking)
      syncInboxBackground(config).catch(e => console.error('[Email] bg sync error:', e.message));

      return res.json({ messages, total, page, pages: Math.ceil(total / limit), cached: true });
    }

    // 2) No cache — do full IMAP fetch (slower)
    fetchInboxIMAP(config, limit, page, res);
  } catch (error) {
    console.error('Erro ao buscar inbox:', error);
    res.status(500).json({ error: 'Erro ao buscar e-mails' });
  }
});

// Background sync — fetch latest UIDs from IMAP and update cache
function syncInboxBackground(config) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: config.email, password: config.password,
      host: config.imap_host, port: config.imap_port,
      tls: true, tlsOptions: { rejectUnauthorized: EMAIL_REJECT_UNAUTHORIZED },
      connTimeout: 15000, authTimeout: 10000,
    });

    const timeout = setTimeout(() => {
      try { imap.end(); } catch {}
      resolve();
    }, 20000);

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err, box) => {
        if (err) { clearTimeout(timeout); imap.end(); return reject(err); }
        const total = box.messages.total;
        // Fetch only most recent 50 headers for cache refresh
        const start = Math.max(1, total - 49);
        const end = total;
        if (total === 0) { clearTimeout(timeout); imap.end(); return resolve(); }

        const newEmails = [];
        const f = imap.seq.fetch(`${start}:${end}`, {
          bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
          struct: true,
        });

        f.on('message', (msg) => {
          let header = '';
          let attrs = null;
          msg.on('body', (stream) => { stream.on('data', (chunk) => { header += chunk.toString('utf8'); }); });
          msg.once('attributes', (a) => { attrs = a; });
          msg.once('end', () => {
            const getHeader = (name) => {
              const regex = new RegExp(`^${name}:\\s*(.+)$`, 'im');
              const match = header.match(regex);
              return match ? match[1].trim() : '';
            };
            const from = getHeader('From');
            const emailMatch = from.match(/<([^>]+)>/);
            newEmails.push({
              uid: attrs?.uid,
              from: from,
              from_address: emailMatch ? emailMatch[1] : from,
              to: getHeader('To'),
              subject: getHeader('Subject') || '(sem assunto)',
              date: getHeader('Date') ? new Date(getHeader('Date')).toISOString() : null,
              seen: attrs?.flags?.includes('\\Seen') ? 1 : 0,
            });
          });
        });

        f.once('end', () => {
          clearTimeout(timeout);
          imap.end();
          // Upsert into cache (fire and forget)
          for (const e of newEmails) {
            db.run(
              `INSERT INTO email_cache (uid, folder, from_raw, from_address, to_raw, subject, date, seen, cached_at)
               VALUES (?, 'INBOX', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
               ON CONFLICT (uid) DO UPDATE SET from_raw=EXCLUDED.from_raw, subject=EXCLUDED.subject, seen=EXCLUDED.seen, cached_at=EXCLUDED.cached_at`,
              [e.uid, e.from, e.from_address, e.to, e.subject, e.date, e.seen]
            ).catch(() => {});
          }
          resolve();
        });
        f.once('error', (err) => { clearTimeout(timeout); imap.end(); reject(err); });
      });
    });

    imap.once('error', (err) => { clearTimeout(timeout); reject(err); });
    imap.connect();
  });
}

// Full IMAP fetch (used on first load when cache is empty)
function fetchInboxIMAP(config, limit, page, res) {
    const imap = new Imap({
      user: config.email,
      password: config.password,
      host: config.imap_host,
      port: config.imap_port,
      tls: true,
      tlsOptions: { rejectUnauthorized: EMAIL_REJECT_UNAUTHORIZED },
      connTimeout: 10000,
      authTimeout: 10000,
    });

    const emails = [];
    let imapTimeout = null;

    // Safety timeout — kill connection after 25s
    imapTimeout = setTimeout(() => {
      try { imap.end(); } catch {}
      if (!res.headersSent) {
        res.json({ messages: emails, total: 0, page, pages: 0, warning: 'Timeout ao buscar e-mails' });
      }
    }, 25000);

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err, box) => {
        if (err) { clearTimeout(imapTimeout); imap.end(); return res.status(500).json({ error: `Erro ao abrir caixa: ${err.message}` }); }
        const total = box.messages.total;
        const start = Math.max(1, total - (page * limit) + 1);
        const end = Math.max(1, total - ((page - 1) * limit));
        if (start > end || total === 0) { clearTimeout(imapTimeout); imap.end(); return res.json({ messages: [], total, page, pages: Math.ceil(total / limit) }); }

        // Fetch only headers + envelope (much faster than full body)
        const f = imap.seq.fetch(`${start}:${end}`, {
          bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
          struct: true,
        });

        f.on('message', (msg) => {
          let header = '';
          let attrs = null;
          msg.on('body', (stream) => {
            stream.on('data', (chunk) => { header += chunk.toString('utf8'); });
          });
          msg.once('attributes', (a) => { attrs = a; });
          msg.once('end', () => {
            // Parse header fields manually (faster than simpleParser)
            const getHeader = (name) => {
              const regex = new RegExp(`^${name}:\\s*(.+)$`, 'im');
              const match = header.match(regex);
              return match ? match[1].trim() : '';
            };
            const from = getHeader('From');
            const subject = getHeader('Subject') || '(sem assunto)';
            const dateStr = getHeader('Date');
            // Extract email address from "Name <email>" format
            const emailMatch = from.match(/<([^>]+)>/);
            const fromAddress = emailMatch ? emailMatch[1] : from;

            emails.push({
              uid: attrs?.uid,
              date: dateStr ? new Date(dateStr) : null,
              from: from,
              from_address: fromAddress,
              to: getHeader('To'),
              subject: subject,
              text: '',
              hasAttachments: false,
              flags: attrs?.flags,
              seen: attrs?.flags?.includes('\\Seen'),
            });
          });
        });

        f.once('error', (err) => { console.error('IMAP fetch error:', err); });
        f.once('end', () => {
          clearTimeout(imapTimeout);
          imap.end();
          emails.sort((a, b) => new Date(b.date) - new Date(a.date));

          // Save to cache for next time (fire and forget)
          for (const e of emails) {
            db.run(
              `INSERT INTO email_cache (uid, folder, from_raw, from_address, to_raw, subject, date, seen, cached_at)
               VALUES (?, 'INBOX', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
               ON CONFLICT (uid) DO UPDATE SET from_raw=EXCLUDED.from_raw, subject=EXCLUDED.subject, seen=EXCLUDED.seen, cached_at=EXCLUDED.cached_at`,
              [e.uid, e.from, e.from_address, e.to, e.subject, e.date ? new Date(e.date).toISOString() : null, e.seen ? 1 : 0]
            ).catch(() => {});
          }

          res.json({ messages: emails, total, page, pages: Math.ceil(total / limit) });
        });
      });
    });

    imap.once('error', (err) => {
      clearTimeout(imapTimeout);
      console.error('IMAP error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: `Erro de conexão IMAP: ${err.message}` });
      }
    });

    imap.connect();
}

// ===== LER UM E-MAIL ESPECÍFICO =====
router.get('/message/:uid', async (req, res) => {
  try {
    const config = await getEmailConfig();
    if (!config) return res.status(400).json({ error: 'Configure o e-mail primeiro' });

    const uid = parseInt(req.params.uid);
    const imap = new Imap({
      user: config.email,
      password: config.password,
      host: config.imap_host,
      port: config.imap_port,
      tls: true,
      tlsOptions: { rejectUnauthorized: EMAIL_REJECT_UNAUTHORIZED },
    });

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) { imap.end(); return res.status(500).json({ error: err.message }); }
        const f = imap.fetch(uid, { bodies: '', struct: true, markSeen: true });
        f.on('message', (msg) => {
          let buffer = '';
          msg.on('body', (stream) => { stream.on('data', (chunk) => { buffer += chunk.toString('utf8'); }); });
          msg.once('end', () => {
            simpleParser(buffer).then(parsed => {
              imap.end();
              res.json({
                uid,
                date: parsed.date,
                from: parsed.from?.text || '',
                from_address: parsed.from?.value?.[0]?.address || '',
                to: parsed.to?.text || '',
                cc: parsed.cc?.text || '',
                subject: parsed.subject || '(sem assunto)',
                text: parsed.text || '',
                html: parsed.html || '',
                attachments: parsed.attachments?.map(a => ({
                  filename: a.filename,
                  size: a.size,
                  contentType: a.contentType,
                })) || [],
              });
            }).catch(e => { imap.end(); res.status(500).json({ error: e.message }); });
          });
        });
        f.once('error', (err) => { imap.end(); res.status(500).json({ error: err.message }); });
      });
    });

    imap.once('error', (err) => res.status(500).json({ error: err.message }));
    imap.connect();
  } catch (error) { res.status(500).json({ error: 'Erro ao ler e-mail' }); }
});

// ===== LISTAR E-MAILS ENVIADOS (do banco) =====
router.get('/sent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const offset = (parseInt(req.query.page) || 0) * limit;
    const [emails, total] = await Promise.all([
      db.all(`SELECT es.*, c.company_name, c.contact_name FROM emails_sent es LEFT JOIN clients c ON es.client_id = c.id ORDER BY es.created_at DESC LIMIT ? OFFSET ?`, [limit, offset]),
      db.get('SELECT COUNT(*) as c FROM emails_sent'),
    ]);
    res.json({ messages: emails, total: total?.c || 0 });
  } catch (error) { res.status(500).json({ error: 'Erro ao listar enviados' }); }
});

export default router;
