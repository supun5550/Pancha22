const express = require('express'), jwt = require('jsonwebtoken'), crypto = require('crypto');
const multer = require('multer'), { Pool } = require('pg'), path = require('path');
const { DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD, PORT = 3000, NODE_ENV } = process.env;
if (!DATABASE_URL || !JWT_SECRET || !ADMIN_PASSWORD) { console.error('Set DATABASE_URL, JWT_SECRET and ADMIN_PASSWORD first.'); process.exit(1); }
const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
const app = express();
app.set('trust proxy', 1);
app.use((req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' }); next(); });
app.use(express.json({ limit: '50kb' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const A = f => (req, res, next) => f(req, res, next).catch(e => { console.error(e); res.status(500).json({ error: 'Server error' }); });

// ---- admin helpers (students need no account; only the owner signs in with one password)
const sha = s => crypto.createHash('sha256').update(String(s || '')).digest();
const getTok = req => ((req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('tok=')) || '').slice(4);
const isAdminReq = req => { try { return jwt.verify(getTok(req), JWT_SECRET).r === 'admin'; } catch (e) { return false; } };
const adminOnly = (req, res, next) => isAdminReq(req) ? next() : res.status(401).json({ error: 'Admin sign-in required' });
const hits = new Map();
const limit = (req, res, next) => {
  const now = Date.now(), h = (hits.get(req.ip) || []).filter(t => now - t < 9e5);
  if (h.length >= 10) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  h.push(now); hits.set(req.ip, h); next();
};
app.post('/api/admin-login', limit, (req, res) => {
  if (!crypto.timingSafeEqual(sha(req.body && req.body.password), sha(ADMIN_PASSWORD))) return res.status(401).json({ error: 'Wrong admin password.' });
  res.cookie('tok', jwt.sign({ r: 'admin' }, JWT_SECRET, { expiresIn: '30d' }), { httpOnly: true, sameSite: 'lax', secure: NODE_ENV === 'production', maxAge: 30 * 864e5 });
  res.json({ admin: true });
});
app.post('/api/logout', (req, res) => { res.clearCookie('tok'); res.json({ ok: true }); });
app.get('/api/me', (req, res) => res.json({ admin: isAdminReq(req) }));

// ---- materials
app.get('/api/items', A(async (req, res) => {
  const r = await pool.query('SELECT id,title,subject,kind,description,url,file_name,mime,(file IS NOT NULL) AS has_file,created FROM items ORDER BY created DESC');
  res.json(r.rows);
}));
app.post('/api/items', adminOnly, (req, res, next) => upload.single('file')(req, res, e => e ? res.status(400).json({ error: e.code === 'LIMIT_FILE_SIZE' ? 'File is over 15 MB. Upload videos to YouTube or Drive and paste the link.' : 'Upload failed.' }) : next()), A(async (req, res) => {
  const b = req.body || {}, title = String(b.title || '').trim().slice(0, 150), link = String(b.link || '').trim();
  if (!title) return res.status(400).json({ error: 'Please enter a title.' });
  if (!req.file && !/^https?:\/\//i.test(link)) return res.status(400).json({ error: 'Add a file or a link starting with http.' });
  const f = req.file;
  await pool.query('INSERT INTO items(title,subject,kind,description,url,file_name,mime,file) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [title, String(b.subject || 'Other').slice(0, 60), b.kind === 'kuppi' ? 'kuppi' : 'note', String(b.desc || '').slice(0, 400), f ? null : link, f ? f.originalname : null, f ? f.mimetype : null, f ? f.buffer : null]);
  res.json({ ok: true });
}));
const up = (req, res, next) => upload.single('file')(req, res, e => e ? res.status(400).json({ error: e.code === 'LIMIT_FILE_SIZE' ? 'File is over 15 MB. Upload videos to YouTube or Drive and paste the link.' : 'Upload failed.' }) : next());
app.put('/api/items/:id', adminOnly, up, A(async (req, res) => {
  const id = +req.params.id || 0, b = req.body || {}, f = req.file;
  const old = (await pool.query('SELECT (file IS NOT NULL) AS has_file FROM items WHERE id=$1', [id])).rows[0];
  if (!old) return res.status(404).json({ error: 'Item not found.' });
  const title = String(b.title || '').trim().slice(0, 150), link = String(b.link || '').trim();
  if (!title) return res.status(400).json({ error: 'Please enter a title.' });
  const meta = [title, String(b.subject || 'Other').slice(0, 60), b.kind === 'kuppi' ? 'kuppi' : 'note', String(b.desc || '').slice(0, 400), id];
  if (f) await pool.query('UPDATE items SET title=$1,subject=$2,kind=$3,description=$4,url=NULL,file_name=$6,mime=$7,file=$8 WHERE id=$5', [...meta, f.originalname, f.mimetype, f.buffer]);
  else if (link) {
    if (!/^https?:\/\//i.test(link)) return res.status(400).json({ error: 'Link must start with http.' });
    await pool.query('UPDATE items SET title=$1,subject=$2,kind=$3,description=$4,url=$6,file_name=NULL,mime=NULL,file=NULL WHERE id=$5', [...meta, link]);
  } else if (old.has_file) await pool.query('UPDATE items SET title=$1,subject=$2,kind=$3,description=$4 WHERE id=$5', meta);
  else return res.status(400).json({ error: 'Add a link or a file.' });
  res.json({ ok: true });
}));
app.delete('/api/items/:id', adminOnly, A(async (req, res) => { await pool.query('DELETE FROM items WHERE id=$1', [+req.params.id || 0]); res.json({ ok: true }); }));
app.get('/api/items/:id/file', A(async (req, res) => {
  const r = await pool.query('SELECT file_name,mime,file FROM items WHERE id=$1 AND file IS NOT NULL', [+req.params.id || 0]);
  const f = r.rows[0]; if (!f) return res.sendStatus(404);
  const safe = /^(application\/pdf|video\/|image\/(png|jpeg|gif|webp)|application\/vnd\.openxmlformats|application\/msword|application\/vnd\.ms-)/.test(f.mime || '');
  res.set('Content-Type', safe ? f.mime : 'application/octet-stream');
  res.set('Content-Disposition', (req.query.dl || !safe ? 'attachment' : 'inline') + "; filename*=UTF-8''" + encodeURIComponent(f.file_name || 'file'));
  res.send(f.file);
}));

// ---- page
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.get('/', (req, res) => {
  res.set('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; media-src 'self'; frame-ancestors 'none'");
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

(async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS items(id SERIAL PRIMARY KEY, title TEXT NOT NULL, subject TEXT, kind TEXT, description TEXT, url TEXT, file_name TEXT, mime TEXT, file BYTEA, created TIMESTAMPTZ DEFAULT now());`);
  app.listen(PORT, () => console.log('22 Agroz running on port ' + PORT));
})().catch(e => { console.error('Startup failed:', e.message); process.exit(1); });
