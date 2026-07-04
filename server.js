import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const BACKUP_DIR = path.join(__dirname, 'backups');

// filter folder: --dir=<path> arg > POE2_FILTER_DIR env > the game's default
const dirArg = process.argv.find((a) => a.startsWith('--dir='));
const POE2_DIR = dirArg ? dirArg.slice(6)
  : process.env.POE2_FILTER_DIR
    || path.join(os.homedir(), 'Documents', 'My Games', 'Path of Exile 2');
const PORT = Number(process.env.PORT) || 7444;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const NAME_RE = /^[A-Za-z0-9 _.-]+\.filter$/i;

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

async function handle(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (url.pathname === '/api/filters' && req.method === 'GET') {
    let files = [];
    if (fs.existsSync(POE2_DIR)) {
      files = fs.readdirSync(POE2_DIR)
        .filter((f) => f.toLowerCase().endsWith('.filter'))
        .map((f) => {
          const st = fs.statSync(path.join(POE2_DIR, f));
          return st.isFile() ? { name: f, size: st.size, mtime: st.mtimeMs } : null;
        })
        .filter(Boolean);
    }
    return json(res, 200, { files, dir: POE2_DIR });
  }

  if (url.pathname === '/api/filter') {
    const name = url.searchParams.get('name') || '';
    if (!NAME_RE.test(name)) return json(res, 400, { error: 'bad filter name' });
    const target = path.join(POE2_DIR, name);

    if (req.method === 'GET') {
      if (!fs.existsSync(target)) return json(res, 404, { error: 'not found' });
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(fs.readFileSync(target, 'utf-8'));
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      let backedUp = null;
      if (fs.existsSync(target)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        backedUp = `${name}.${ts}.bak`;
        fs.copyFileSync(target, path.join(BACKUP_DIR, backedUp));
      }
      fs.mkdirSync(POE2_DIR, { recursive: true });
      fs.writeFileSync(target, body, 'utf-8');
      return json(res, 200, { ok: true, backedUp, path: target });
    }
  }

  // static
  if (req.method === 'GET') {
    let p = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = path.normalize(path.join(PUBLIC_DIR, p));
    if (!file.startsWith(PUBLIC_DIR)) return json(res, 403, { error: 'forbidden' });
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      return res.end(fs.readFileSync(file));
    }
  }

  json(res, 404, { error: 'not found' });
}

const server = http.createServer(async (req, res) => {
  try {
    await handle(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) json(res, 500, { error: String(err.message || err) });
    else res.end();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`POE2 Filter Studio → http://127.0.0.1:${PORT}  (filters: ${POE2_DIR})`);
});
