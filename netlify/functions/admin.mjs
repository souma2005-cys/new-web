import crypto from 'node:crypto';
import { getData, setData, password, makeSession, validSession, cookie, corsSameOrigin, json, readJson, validateData, normalizeData, saveCertificate, securityHeaders } from './_shared.mjs';

const attempts = new Map();
function tooMany(ip) { const now = Date.now(); const rec = attempts.get(ip) || { n: 0, reset: now + 10*60*1000 }; if (now > rec.reset) { rec.n = 0; rec.reset = now + 10*60*1000; } rec.n += 1; attempts.set(ip, rec); return rec.n > 10; }

export default async function handler(request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || (url.pathname.split('/').pop() || '');
  if (!corsSameOrigin(request)) return json({error:'Invalid origin.'}, 403, securityHeaders);
  try {
    if (action === 'session' && request.method === 'GET') return json({ authenticated: validSession(request) }, 200, securityHeaders);
    if (action === 'login' && request.method === 'POST') {
      if (tooMany(request.headers.get('x-forwarded-for') || 'unknown')) return json({error:'Too many login attempts. Try again later.'}, 429, securityHeaders);
      const body = await readJson(request); const supplied = String(body.password || ''); const expected = password();
      const ok = Buffer.byteLength(supplied) === Buffer.byteLength(expected) && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
      if (!ok) return json({error:'Incorrect password.'}, 401, securityHeaders);
      attempts.clear();
      return json({authenticated:true}, 200, {...securityHeaders, 'Set-Cookie': cookie('sid', makeSession(), 8*60*60)});
    }
    if (action === 'logout' && request.method === 'POST') return json({authenticated:false}, 200, {...securityHeaders, 'Set-Cookie': cookie('sid','',0)});
    if (!validSession(request)) return json({error:'Authentication required.'}, 401, securityHeaders);
    if (action === 'certificate' && request.method === 'POST') {
      const body = await readJson(request); const image = await saveCertificate(body.image); return json({image}, 201, securityHeaders);
    }
    if ((action === 'portfolio' || action === 'save') && request.method === 'PUT') {
      const incoming = await readJson(request); validateData(incoming); const normalized = normalizeData(incoming); await setData(normalized); return json(normalized, 200, securityHeaders);
    }
    return json({error:'Not found.'}, 404, securityHeaders);
  } catch (error) { return json({error:error?.message || 'Server error.'}, 400, securityHeaders); }
}
export const config = { path: '/api/admin/*' };
