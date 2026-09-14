import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STORE = getStore({ name: 'souma-portfolio', consistency: 'strong' });
const DATA_KEY = 'data.json';
const SESSION_TTL = 8 * 60 * 60;
const MAX_CERT_BYTES = 5 * 1024 * 1024;
const INITIAL_DATA = {
  personal: { name: 'Souma Deep Pal', title: 'Cybersecurity Student & Penetration Testing Intern', bio: 'A cybersecurity student focused on networking, vulnerability assessment, system security, and practical defensive tooling.', email: 'soumadeeppal33@gmail.com', phone: '+91 73845 68795', location: 'India' },
  about: { para1: '', para2: '' }, experience: [], education: [], certifications: [], skills: [], projects: [],
  contact: { heading: 'Get In Touch', desc: '' }, social: { github: '', linkedin: '' }
};

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
}

export function text(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
}

export async function getData() {
  const stored = await STORE.get(DATA_KEY, { type: 'json' });
  if (stored) return stored;
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const projectRoot = path.join(__dirname, '../../');
    const file = await fs.readFile(path.join(projectRoot, 'data.json'), 'utf8');
    const parsed = JSON.parse(file);
    await STORE.setJSON(DATA_KEY, parsed);
    return parsed;
  } catch {
    return structuredClone(INITIAL_DATA);
  }
}

export async function setData(data) { await STORE.setJSON(DATA_KEY, data); }

export function password() { return process.env.ADMIN_PASSWORD || 'souma@2005'; }

function secret() { return process.env.ADMIN_SESSION_SECRET || `local-${password()}`; }

export function makeSession() {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL;
  const payload = `${exp}`;
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function validSession(request) {
  const raw = request.headers.get('cookie') || '';
  const match = raw.match(/(?:^|;)\s*sid=([^;]+)/);
  if (!match) return false;
  const token = decodeURIComponent(match[1]);
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Math.floor(Date.now() / 1000)) return false;
  const expected = crypto.createHmac('sha256', secret()).update(exp).digest('base64url');
  try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); } catch { return false; }
}

export function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAge}`;
}

export function corsSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}

export async function readJson(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 8 * 1024 * 1024) throw new Error('Request too large.');
  const body = await request.json();
  if (!body || typeof body !== 'object') throw new Error('Invalid JSON.');
  return body;
}

export function validateData(next) {
  if (!next || typeof next !== 'object') throw new Error('Invalid portfolio data.');
  for (const key of ['experience','education','certifications','skills','projects']) {
    if (!Array.isArray(next[key]) || next[key].length > 50) throw new Error(`Invalid ${key} data.`);
  }
  for (const key of ['personal','about','contact','social']) if (!next[key] || typeof next[key] !== 'object') throw new Error('Missing required sections.');
}

function safeHttpUrl(value) {
  if (!value) return '';
  try { const u = new URL(String(value)); return ['http:','https:'].includes(u.protocol) ? u.toString() : ''; } catch { return ''; }
}

export function normalizeData(data) {
  const result = structuredClone(data);
  for (const section of ['personal','about','contact','social']) for (const [k,v] of Object.entries(result[section])) result[section][k] = String(v ?? '').slice(0, 5000);
  result.social.github = safeHttpUrl(result.social.github); result.social.linkedin = safeHttpUrl(result.social.linkedin);
  result.certifications = result.certifications.map(c => ({ date:String(c.date||'').slice(0,60), name:String(c.name||'').slice(0,160), issuer:String(c.issuer||'').slice(0,160), image:String(c.image||'').slice(0,500) }));
  return result;
}

export async function saveCertificate(dataUrl) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!match) throw new Error('Certificate images must be PNG, JPEG, or WebP.');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_CERT_BYTES) throw new Error('Certificate image must be between 1 byte and 5 MB.');
  const ext = match[1] === 'image/jpeg' ? 'jpg' : match[1].split('/')[1];
  const key = `certs/certificate-${crypto.randomBytes(12).toString('hex')}.${ext}`;
  await STORE.set(key, buffer, { metadata: { contentType: match[1] } });
  return `/${key}`;
}

export async function getCertificate(key) {
  if (!/^certs\/certificate-[A-Za-z0-9-]+\.(?:png|jpg|jpeg|webp)$/i.test(key)) return null;
  const result = await STORE.getWithMetadata(key, { type: 'arrayBuffer' });
  return result;
}

export const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};
