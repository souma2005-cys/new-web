'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data.json');
const CERT_DIR = path.join(ROOT, 'certs');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'souma@2005';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const BODY_LIMIT = 7 * 1024 * 1024;
const MAX_CERT_BYTES = 5 * 1024 * 1024;
const sessions = new Map();
const loginAttempts = new Map();

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon'
};

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (error) {
    console.error('Unable to read data.json:', error.message);
    process.exit(1);
  }
}

function saveData(data) {
  const temp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, DATA_FILE);
}

function send(response, status, body, headers = {}) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body);
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
    'Content-Length': payload.length,
    ...headers
  });
  response.end(payload);
}

function sendJson(response, status, data, headers = {}) {
  send(response, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8', ...headers });
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').filter(Boolean).map(part => {
    const index = part.indexOf('=');
    return index === -1 ? [part.trim(), ''] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }));
}

function isAuthenticated(request) {
  const sid = parseCookies(request).sid;
  if (!sid) return false;
  const session = sessions.get(sid);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(sid);
    return false;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return true;
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

function collectBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', chunk => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(new Error('Request too large.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function validateData(next) {
  if (!next || typeof next !== 'object') throw new Error('Invalid portfolio data.');
  const arrays = ['experience', 'education', 'certifications', 'skills', 'projects'];
  arrays.forEach(key => {
    if (!Array.isArray(next[key])) throw new Error(`Invalid ${key} data.`);
    if (next[key].length > 50) throw new Error(`${key} contains too many items.`);
  });
  if (!next.personal || !next.about || !next.contact || !next.social) throw new Error('Missing required sections.');
}

function sanitizeUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function normalizeData(data) {
  const result = JSON.parse(JSON.stringify(data));
  result.personal.email = String(result.personal.email || '').slice(0, 200);
  result.personal.phone = String(result.personal.phone || '').slice(0, 60);
  result.social.github = sanitizeUrl(result.social.github);
  result.social.linkedin = sanitizeUrl(result.social.linkedin);
  result.certifications = result.certifications.map(cert => ({
    date: String(cert.date || '').slice(0, 60),
    name: String(cert.name || '').slice(0, 160),
    issuer: String(cert.issuer || '').slice(0, 160),
    image: String(cert.image || '').trim().slice(0, 1000)
  }));
  return result;
}

function saveUploadedCertificate(dataUrl) {
  if (!dataUrl) return '';
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error('Certificate images must be PNG, JPEG, or WebP.');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > MAX_CERT_BYTES) throw new Error('Certificate image is too large.');
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const filename = `certificate-${crypto.randomBytes(10).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(CERT_DIR, filename), buffer);
  return `certs/${filename}`;
}

function normalizeCertificatePath(value) {
  const image = String(value || '').trim();
  if (!image) return '';
  if (/^https?:\/\//i.test(image)) return '';
  const normalized = image.replace(/\\/g, '/').replace(/^\/+/, '/');
  if (!/^\/?certs\/[A-Za-z0-9._-]+\.(?:png|jpe?g|webp)$/i.test(normalized)) {
    throw new Error('Invalid certificate image path. Upload the image again.');
  }
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function handleApi(request, response, url) {
  if (url.pathname === '/api/portfolio' && request.method === 'GET') {
    return sendJson(response, 200, loadData());
  }

  if (url.pathname === '/api/admin/session' && request.method === 'GET') {
    return sendJson(response, 200, { authenticated: isAuthenticated(request) });
  }

  if (url.pathname === '/api/admin/login' && request.method === 'POST') {
    if (!ADMIN_PASSWORD) return sendJson(response, 503, { error: 'Set ADMIN_PASSWORD before starting the server.' });
    if (!sameOrigin(request)) return sendJson(response, 403, { error: 'Invalid origin.' });
    const now = Date.now();
    const record = loginAttempts.get(request.socket.remoteAddress) || { count: 0, resetAt: now + 10 * 60 * 1000 };
    if (now > record.resetAt) { record.count = 0; record.resetAt = now + 10 * 60 * 1000; }
    if (record.count >= 10) return sendJson(response, 429, { error: 'Too many login attempts. Try again later.' });
    record.count += 1;
    loginAttempts.set(request.socket.remoteAddress, record);

    return collectBody(request).then(raw => {
      let body;
      try { body = JSON.parse(raw || '{}'); } catch { return sendJson(response, 400, { error: 'Invalid JSON.' }); }
      const supplied = String(body.password || '');
      const valid = Buffer.byteLength(supplied) === Buffer.byteLength(ADMIN_PASSWORD) && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(ADMIN_PASSWORD));
      if (!valid) return sendJson(response, 401, { error: 'Incorrect password.' });
      const sid = crypto.randomBytes(32).toString('hex');
      sessions.set(sid, { expiresAt: Date.now() + SESSION_TTL_MS });
      loginAttempts.delete(request.socket.remoteAddress);
      sendJson(response, 200, { authenticated: true }, {
        'Set-Cookie': `sid=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`
      });
    }).catch(error => sendJson(response, 400, { error: error.message }));
  }

  if (url.pathname === '/api/admin/logout' && request.method === 'POST') {
    if (!sameOrigin(request)) return sendJson(response, 403, { error: 'Invalid origin.' });
    const sid = parseCookies(request).sid;
    if (sid) sessions.delete(sid);
    return sendJson(response, 200, { authenticated: false }, { 'Set-Cookie': 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  }

  if (url.pathname === '/api/admin/certificate' && request.method === 'POST') {
    if (!isAuthenticated(request)) return sendJson(response, 401, { error: 'Authentication required.' });
    if (!sameOrigin(request)) return sendJson(response, 403, { error: 'Invalid origin.' });
    return collectBody(request).then(raw => {
      let body;
      try { body = JSON.parse(raw || '{}'); } catch { return sendJson(response, 400, { error: 'Invalid JSON.' }); }
      try {
        const image = String(body.image || '');
        const stored = saveUploadedCertificate(image);
        sendJson(response, 201, { image: `/${stored}` });
      } catch (error) {
        sendJson(response, 400, { error: error.message });
      }
    }).catch(error => sendJson(response, 400, { error: error.message }));
  }

  if (url.pathname === '/api/admin/portfolio' && request.method === 'PUT') {
    if (!isAuthenticated(request)) return sendJson(response, 401, { error: 'Authentication required.' });
    if (!sameOrigin(request)) return sendJson(response, 403, { error: 'Invalid origin.' });
    return collectBody(request).then(raw => {
      let incoming;
      try { incoming = JSON.parse(raw || '{}'); } catch { return sendJson(response, 400, { error: 'Invalid JSON.' }); }
      try {
        validateData(incoming);
        const normalized = normalizeData(incoming);
        normalized.certifications = normalized.certifications.map(cert => ({
          ...cert,
          image: normalizeCertificatePath(cert.image)
        }));
        saveData(normalized);
        sendJson(response, 200, normalized);
      } catch (error) {
        sendJson(response, 400, { error: error.message });
      }
    }).catch(error => sendJson(response, 400, { error: error.message }));
  }

  return false;
}

function serveStatic(request, response, url) {
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return send(response, 400, 'Bad request.'); }
  if (pathname === '/admin') pathname = '/admin.html';
  if (pathname === '/') pathname = '/index.html';
  if (pathname.includes('..')) return send(response, 403, 'Forbidden.');
  const basename = path.basename(pathname);
  if (basename === 'data.json' || basename.startsWith('.') || pathname.includes('/.')) return send(response, 404, 'Not found.');

  const filePath = path.resolve(ROOT, `.${pathname}`);
  if (!filePath.startsWith(ROOT + path.sep)) return send(response, 403, 'Forbidden.');

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) return send(response, 404, 'Not found.');
    fs.readFile(filePath, (readError, content) => {
      if (readError) return send(response, 500, 'Server error.');
      send(response, 200, content, { 'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    });
  });
}

const server = http.createServer((request, response) => {
  if (/(?:^|\/)\.\.(?:\/|$)/.test(request.url)) return send(response, 403, 'Forbidden.');
  const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);
  if (request.method === 'OPTIONS') return send(response, 204, Buffer.alloc(0), { Allow: 'GET,POST,PUT,OPTIONS' });
  const handled = handleApi(request, response, url);
  if (handled !== false) return;
  serveStatic(request, response, url);
});

server.listen(PORT, HOST, () => {
  console.log(`Portfolio: http://${HOST}:${PORT}`);
  console.log(`Admin:     http://${HOST}:${PORT}/admin`);
  if (!ADMIN_PASSWORD) console.warn('WARNING: ADMIN_PASSWORD is not set; admin login is disabled.');
});

setInterval(() => {
  const now = Date.now();
  for (const [sid, session] of sessions) if (session.expiresAt < now) sessions.delete(sid);
  for (const [key, record] of loginAttempts) if (record.resetAt < now) loginAttempts.delete(key);
}, 60_000).unref();
