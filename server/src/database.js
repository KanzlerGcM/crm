import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dns from 'dns';
import { ENCRYPTION_KEY } from './config.js';

// Force IPv4 to avoid IPv6 connection issues
dns.setDefaultResultOrder('ipv4first');

const { Pool } = pg;

// AES-256 encrypt/decrypt for sensitive data (email passwords)
const IV_LEN = 16;
export function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}
export function decrypt(text) {
  if (!text || !text.includes(':')) return text;
  const [ivHex, encHex] = text.split(':');
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, Buffer.from(ivHex, 'hex'));
    let decrypted = decipher.update(encHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return text; // Return as-is if not encrypted (migration)
  }
}

// PostgreSQL connection pool (Supabase or any Postgres provider)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase')
    ? { rejectUnauthorized: false }
    : (process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  // Transaction pooler (Supabase port 6543) does not support prepared statements
  allowExitOnIdle: true,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

// Convert SQLite ? positional placeholders → PostgreSQL $1, $2, ...
function toPositional(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// No-op — PostgreSQL persists automatically
export function saveOnShutdown() {
  console.log('✅ PostgreSQL — sem save local necessário');
}

export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Create core tables ──
    await client.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, name TEXT NOT NULL,
      role TEXT DEFAULT 'user', active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY, company_name TEXT NOT NULL,
      contact_name TEXT NOT NULL, email TEXT, phone TEXT, cnpj TEXT,
      address TEXT, city TEXT, state TEXT, website TEXT,
      status TEXT DEFAULT 'prospect', interest TEXT, source TEXT, notes TEXT,
      priority TEXT DEFAULT 'medium', estimated_value DOUBLE PRECISION, assigned_to INTEGER,
      version INTEGER DEFAULT 1, lead_score INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS interactions (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      type TEXT NOT NULL, description TEXT NOT NULL,
      next_follow_up DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS contracts (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
      contract_number TEXT UNIQUE NOT NULL, contract_type TEXT NOT NULL,
      plan_type TEXT NOT NULL, value DOUBLE PRECISION NOT NULL, payment_method TEXT,
      installments INTEGER DEFAULT 1, discount_percent DOUBLE PRECISION DEFAULT 0,
      final_value DOUBLE PRECISION NOT NULL, start_date DATE, delivery_date DATE,
      renewal_date DATE, status TEXT DEFAULT 'draft', custom_clauses TEXT, notes TEXT,
      version INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS email_settings (
      id INTEGER PRIMARY KEY, smtp_host TEXT NOT NULL, smtp_port INTEGER DEFAULT 587,
      imap_host TEXT, imap_port INTEGER DEFAULT 993,
      email_address TEXT NOT NULL, email_password TEXT NOT NULL,
      from_name TEXT DEFAULT 'Chevla',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS emails_sent (
      id SERIAL PRIMARY KEY, to_address TEXT NOT NULL,
      subject TEXT NOT NULL, body TEXT, message_id TEXT,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY, title TEXT NOT NULL, description TEXT,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      contract_id INTEGER REFERENCES contracts(id) ON DELETE SET NULL,
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'pending', priority TEXT DEFAULT 'medium',
      due_date DATE, completed_at TIMESTAMP,
      recurrence_rule TEXT, last_recurrence_at TIMESTAMP,
      version INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      amount DOUBLE PRECISION NOT NULL, due_date DATE NOT NULL, paid_date DATE,
      status TEXT DEFAULT 'pending', payment_method TEXT,
      installment_number INTEGER DEFAULT 1, notes TEXT,
      version INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      entity_type TEXT NOT NULL, entity_id INTEGER,
      action TEXT NOT NULL, details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS pagespeed_reports (
      id SERIAL PRIMARY KEY, url TEXT NOT NULL, strategy TEXT DEFAULT 'mobile',
      scores_json TEXT, metrics_json TEXT, opportunities_json TEXT, diagnostics_json TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS calendar_events (
      id SERIAL PRIMARY KEY, title TEXT NOT NULL, description TEXT,
      date DATE NOT NULL, time TEXT, end_date DATE, end_time TEXT,
      color TEXT DEFAULT '#0077FF', category TEXT DEFAULT 'event',
      all_day INTEGER DEFAULT 1, created_by INTEGER,
      version INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS email_templates (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, subject TEXT NOT NULL,
      body TEXT NOT NULL, category TEXT DEFAULT 'general',
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      phone TEXT NOT NULL, message TEXT NOT NULL, template_name TEXT,
      sent_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS attachments (
      id SERIAL PRIMARY KEY, entity_type TEXT NOT NULL, entity_id INTEGER NOT NULL,
      filename TEXT NOT NULL, original_name TEXT NOT NULL,
      mime_type TEXT, size INTEGER DEFAULT 0,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY, invoice_number TEXT NOT NULL UNIQUE,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
      contract_id INTEGER REFERENCES contracts(id) ON DELETE SET NULL,
      issue_date DATE NOT NULL DEFAULT CURRENT_DATE, due_date DATE,
      description TEXT, subtotal DOUBLE PRECISION DEFAULT 0,
      discount DOUBLE PRECISION DEFAULT 0, tax_rate DOUBLE PRECISION DEFAULT 0,
      tax_amount DOUBLE PRECISION DEFAULT 0, total DOUBLE PRECISION DEFAULT 0,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','issued','paid','cancelled','overdue')),
      payment_method TEXT, paid_date DATE, notes TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      version INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS invoice_items (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity DOUBLE PRECISION DEFAULT 1,
      unit_price DOUBLE PRECISION DEFAULT 0,
      total DOUBLE PRECISION DEFAULT 0
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS email_cache (
      uid INTEGER PRIMARY KEY,
      folder TEXT DEFAULT 'INBOX',
      from_raw TEXT, from_address TEXT, to_raw TEXT, subject TEXT,
      date TEXT, flags TEXT, has_attachments INTEGER DEFAULT 0,
      seen INTEGER DEFAULT 0,
      cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // ── Indexes ──
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status)',
      'CREATE INDEX IF NOT EXISTS idx_clients_created ON clients(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company_name)',
      'CREATE INDEX IF NOT EXISTS idx_clients_assigned ON clients(assigned_to)',
      'CREATE INDEX IF NOT EXISTS idx_interactions_client ON interactions(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_interactions_followup ON interactions(next_follow_up)',
      'CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status)',
      'CREATE INDEX IF NOT EXISTS idx_contracts_delivery ON contracts(delivery_date)',
      'CREATE INDEX IF NOT EXISTS idx_emails_sent_client ON emails_sent(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_client ON tasks(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to)',
      'CREATE INDEX IF NOT EXISTS idx_payments_contract ON payments(contract_id)',
      'CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)',
      'CREATE INDEX IF NOT EXISTS idx_payments_due ON payments(due_date)',
      'CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_payments_updated ON payments(updated_at)',
      'CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id)',
      'CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(date)',
      'CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_contract ON invoices(contract_id)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_due ON invoices(due_date)',
      'CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id)',
      'CREATE INDEX IF NOT EXISTS idx_email_cache_folder ON email_cache(folder, date DESC)',
    ];
    for (const idx of indexes) {
      try { await client.query(idx); } catch { /* already exists */ }
    }

    await client.query('COMMIT');

    // ── Default admin user ──
    const adminUser = process.env.ADMIN_USERNAME;
    const adminPass = process.env.ADMIN_PASSWORD;
    if (!adminUser || !adminPass) {
      console.warn('⚠️  ADMIN_USERNAME / ADMIN_PASSWORD não definidos no .env — admin não será criado/atualizado');
    } else {
      const adminHash = bcrypt.hashSync(adminPass, 10);
      const existing = await pool.query('SELECT id FROM users WHERE username = $1', [adminUser]);
      if (existing.rows.length === 0) {
        await pool.query("DELETE FROM users WHERE username = 'admin'");
        await pool.query('INSERT INTO users (username, password_hash, name, role) VALUES ($1, $2, $3, $4)',
          [adminUser, adminHash, 'Administrador Chevla', 'admin']);
        console.log('✅ Usuário admin criado');
      } else {
        await pool.query('UPDATE users SET password_hash = $1 WHERE username = $2', [adminHash, adminUser]);
      }
    }

    // ── Default email settings from .env ──
    const emailCheck = await pool.query('SELECT id FROM email_settings WHERE id = 1');
    if (emailCheck.rows.length === 0) {
      const smtpHost = process.env.SMTP_HOST;
      const emailAddr = process.env.EMAIL_ADDRESS;
      const emailPass = process.env.EMAIL_PASSWORD;
      if (smtpHost && emailAddr && emailPass) {
        const smtpPort = process.env.SMTP_PORT || 465;
        const imapHost = process.env.IMAP_HOST || smtpHost.replace('smtp', 'imap');
        const imapPort = process.env.IMAP_PORT || 993;
        const fromName = process.env.EMAIL_FROM_NAME || 'Chevla';
        const encryptedPass = encrypt(emailPass);
        await pool.query(
          `INSERT INTO email_settings (id, smtp_host, smtp_port, imap_host, imap_port, email_address, email_password, from_name)
           VALUES (1, $1, $2, $3, $4, $5, $6, $7)`,
          [smtpHost, smtpPort, imapHost, imapPort, emailAddr, encryptedPass, fromName]
        );
        console.log('✅ Configurações de e-mail pré-configuradas');
      } else {
        console.warn('⚠️  Variáveis de e-mail não definidas no .env — configure em Configurações');
      }
    }

    console.log('✅ Banco de dados PostgreSQL inicializado com sucesso');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('❌ Erro ao inicializar banco de dados:', e.message);
    throw e;
  } finally {
    client.release();
  }
}

// ── Async database API ──

const db = {
  async get(sql, params = []) {
    const { rows } = await pool.query(toPositional(sql), params);
    return rows[0] || null;
  },

  async all(sql, params = []) {
    const { rows } = await pool.query(toPositional(sql), params);
    return rows;
  },

  async run(sql, params = []) {
    const isInsert = /^\s*INSERT/i.test(sql);
    let pgSql = toPositional(sql);
    if (isInsert && !/RETURNING/i.test(pgSql)) {
      pgSql += ' RETURNING id';
    }
    const result = await pool.query(pgSql, params);
    return {
      lastInsertRowid: result.rows[0]?.id ?? 0,
      changes: result.rowCount ?? 0,
    };
  },

  async transaction(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const txDb = {
        async get(sql, params = []) {
          const { rows } = await client.query(toPositional(sql), params);
          return rows[0] || null;
        },
        async all(sql, params = []) {
          const { rows } = await client.query(toPositional(sql), params);
          return rows;
        },
        async run(sql, params = []) {
          const isInsert = /^\s*INSERT/i.test(sql);
          let pgSql = toPositional(sql);
          if (isInsert && !/RETURNING/i.test(pgSql)) pgSql += ' RETURNING id';
          const result = await client.query(pgSql, params);
          return {
            lastInsertRowid: result.rows[0]?.id ?? 0,
            changes: result.rowCount ?? 0,
          };
        },
      };
      const result = await fn(txDb);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  async audit(userId, entityType, entityId, action, details) {
    try {
      await pool.query(
        'INSERT INTO activity_log (user_id, entity_type, entity_id, action, details) VALUES ($1, $2, $3, $4, $5)',
        [userId ?? null, entityType, entityId ?? null, action, details ?? null]
      );
    } catch (e) {
      console.error('Audit log error:', e.message);
    }
  },
};

export default db;
