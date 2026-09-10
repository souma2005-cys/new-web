import { getData, json, securityHeaders } from './_shared.mjs';
export default async function handler() { return json(await getData(), 200, securityHeaders); }
export const config = { path: '/api/portfolio' };
