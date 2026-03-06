import { Router } from 'express';
import multer from 'multer';
import { existsSync, mkdirSync, unlinkSync, createReadStream } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';
import db from '../database.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UPLOAD_DIR = join(__dirname, '..', '..', 'data', 'uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + extname(file.originalname)),
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf','image/jpeg','image/png','image/webp',
      'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain','text/csv'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de arquivo não permitido'), false);
  },
});

const router = Router();
router.use(authMiddleware);

router.get('/:entityType/:entityId', async (req, res) => {
  const { entityType, entityId } = req.params;
  const id = Number(entityId);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
  if (!['client','contract','task','payment'].includes(entityType)) return res.status(400).json({ error: 'Tipo de entidade inválido' });
  try {
    const attachments = await db.all(`
      SELECT a.*, u.name as uploaded_by_name
      FROM attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.entity_type = ? AND a.entity_id = ?
      ORDER BY a.created_at DESC
    `, [entityType, id]);
    res.json(attachments);
  } catch (err) {
    console.error('Attachment list error:', err);
    res.status(500).json({ error: 'Erro ao listar anexos' });
  }
});

router.post('/:entityType/:entityId', upload.single('file'), async (req, res) => {
  const { entityType, entityId } = req.params;
  const id = Number(entityId);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
  if (!['client','contract','task','payment'].includes(entityType)) return res.status(400).json({ error: 'Tipo de entidade inválido' });
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  try {
    const result = await db.run(
      `INSERT INTO attachments (entity_type, entity_id, filename, original_name, mime_type, size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [entityType, id, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, req.user.id]
    );
    await db.audit(req.user.id, 'attachment', result.lastInsertRowid, 'uploaded', `${req.file.originalname} para ${entityType}#${id}`);
    res.status(201).json({ id: result.lastInsertRowid, filename: req.file.filename, original_name: req.file.originalname, size: req.file.size, message: 'Arquivo enviado' });
  } catch (err) {
    console.error('Attachment upload error:', err);
    res.status(500).json({ error: 'Erro ao enviar arquivo' });
  }
});

router.get('/download/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
  try {
    const attachment = await db.get('SELECT * FROM attachments WHERE id = ?', [id]);
    if (!attachment) return res.status(404).json({ error: 'Anexo não encontrado' });
    const filePath = join(UPLOAD_DIR, attachment.filename);
    if (!existsSync(filePath)) return res.status(404).json({ error: 'Arquivo não encontrado no disco' });
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.original_name)}"`);
    res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
    createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('Attachment download error:', err);
    res.status(500).json({ error: 'Erro ao baixar arquivo' });
  }
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
  try {
    const attachment = await db.get('SELECT * FROM attachments WHERE id = ?', [id]);
    if (!attachment) return res.status(404).json({ error: 'Anexo não encontrado' });
    if (req.user.role !== 'admin' && attachment.uploaded_by !== req.user.id) return res.status(403).json({ error: 'Apenas o autor ou admin pode remover este anexo' });
    const filePath = join(UPLOAD_DIR, attachment.filename);
    try { unlinkSync(filePath); } catch { }
    await db.run('DELETE FROM attachments WHERE id = ?', [id]);
    await db.audit(req.user.id, 'attachment', id, 'deleted', attachment.original_name);
    res.json({ message: 'Anexo removido' });
  } catch (err) {
    console.error('Attachment delete error:', err);
    res.status(500).json({ error: 'Erro ao remover anexo' });
  }
});

export default router;
