import { getCertificate, securityHeaders, text } from './_shared.mjs';
export default async function handler(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || '';
  const result = await getCertificate(key);
  if (!result?.data) return text('Not found.', 404, securityHeaders);
  return new Response(result.data, { status:200, headers:{...securityHeaders, 'Content-Type': result.metadata?.contentType || 'application/octet-stream', 'Cache-Control':'public, max-age=31536000, immutable'} });
}
export const config = { path: '/certificates/*' };
