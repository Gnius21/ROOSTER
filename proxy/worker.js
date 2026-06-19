/**
 * Rooster Observatoren — Anthropic API proxy (Cloudflare Worker)
 *
 * The API key never leaves this Worker. The browser sends only the
 * image + prompt; the Worker adds the key and forwards to Anthropic.
 *
 * Deploy:
 *   1. npm install -g wrangler          (once)
 *   2. wrangler login                   (once)
 *   3. wrangler deploy                  (from this directory)
 *   4. wrangler secret put ANTHROPIC_API_KEY
 *      → paste your sk-ant-... key when prompted
 *   5. Copy the printed Worker URL into the Rooster app
 *      (paste it in the upload-zone settings field)
 */

const ALLOWED_ORIGINS = [
  'https://gnius21.github.io',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin);

    const cors = allowed ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    } : {};

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (!allowed) {
      return new Response('Forbidden', { status: 403 });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: 'ANTHROPIC_API_KEY secret not set on the Worker' }, 500, cors);
    }

    let body;
    try { body = await request.text(); }
    catch { return new Response('Bad request body', { status: 400, headers: cors }); }

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body,
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  },
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
