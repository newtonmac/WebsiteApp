// Cloudflare Worker: App Suggestions
// Stores user-submitted app ideas in KV and sends email notification.
// Deploy: npx wrangler deploy
//
// Required env vars (set via wrangler secret or dashboard):
//   NOTIFY_EMAIL - email address to receive suggestion notifications
//   FROM_EMAIL   - sender email (must be from a verified domain)
//
// Email is sent via MailChannels (free for Cloudflare Workers).
// Setup: Add a DNS TXT record for your domain:
//   _mailchannels.yourdomain.com  TXT  "v=mc1 cfid=your-worker-subdomain"

const ALLOWED_ORIGINS = [
  'https://jmlsd.org',
  'https://www.jmlsd.org',
  'https://paddlepoint.org',
  'https://www.paddlepoint.org',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return handleCors(request, new Response(null, { status: 204 }));
    }

    const url = new URL(request.url);

    try {
      if (request.method === 'POST' && url.pathname === '/suggest') {
        return handleCors(request, await submitSuggestion(request, env));
      }

      if (request.method === 'GET' && url.pathname === '/suggestions') {
        return handleCors(request, await getSuggestions(env));
      }

      // Admin: delete (dismiss) a suggestion
      const deleteMatch = url.pathname.match(/^\/admin\/suggestions\/(.+)$/);
      if (request.method === 'DELETE' && deleteMatch) {
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.replace('Bearer ', '');
        if (!env.ADMIN_KEY || token !== env.ADMIN_KEY) {
          return handleCors(request, new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401, headers: { 'Content-Type': 'application/json' },
          }));
        }
        return handleCors(request, await deleteSuggestion(deleteMatch[1], env));
      }

      return handleCors(request, new Response('Not found', { status: 404 }));
    } catch (err) {
      const resp = new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return handleCors(request, resp);
    }
  },
};

async function submitSuggestion(request, env) {
  const body = await request.json();
  const { name, title, description, club, craft } = body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Title is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Rate limiting: max 5 suggestions per IP per day
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const today = new Date().toISOString().slice(0, 10);
  const rateKey = `rate:${ip}:${today}`;
  const rateCount = parseInt(await env.SUGGESTIONS.get(rateKey) || '0');

  if (rateCount >= 5) {
    return new Response(JSON.stringify({ error: 'Too many suggestions today. Try again tomorrow.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await env.SUGGESTIONS.put(rateKey, (rateCount + 1).toString(), { expirationTtl: 86400 });

  // Store the suggestion
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const suggestion = {
    id,
    name: (name || 'Anonymous').slice(0, 100),
    title: title.trim().slice(0, 200),
    description: (description || '').slice(0, 1000),
    club: (club || '').slice(0, 200),
    craft: (craft || '').slice(0, 50),
    timestamp: new Date().toISOString(),
    city: (request.cf && request.cf.city) || 'Unknown',
    country: (request.cf && request.cf.country) || 'Unknown',
  };

  await env.SUGGESTIONS.put(`suggestion:${id}`, JSON.stringify(suggestion));

  // Update index
  const index = JSON.parse(await env.SUGGESTIONS.get('index') || '[]');
  index.push(id);
  await env.SUGGESTIONS.put('index', JSON.stringify(index));

  // Send email notification (fire-and-forget)
  sendEmailNotification(suggestion, env).catch(() => {});

  return new Response(JSON.stringify({ success: true, id }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function sendEmailNotification(suggestion, env) {
  const toEmail = env.NOTIFY_EMAIL;
  const fromEmail = env.FROM_EMAIL;
  if (!toEmail || !fromEmail) return;

  await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: toEmail }] }],
      from: { email: fromEmail, name: 'JMLSD Apps' },
      subject: `New App Suggestion: ${suggestion.title}`,
      content: [{
        type: 'text/plain',
        value: [
          `New suggestion from ${suggestion.name}`,
          `Location: ${suggestion.city}, ${suggestion.country}`,
          suggestion.club ? `Paddling Club: ${suggestion.club}` : '',
          suggestion.craft ? `Craft: ${suggestion.craft}` : '',
          `Time: ${suggestion.timestamp}`,
          '',
          `Title: ${suggestion.title}`,
          '',
          `Description:`,
          suggestion.description || '(none)',
          '',
          `ID: ${suggestion.id}`,
        ].join('\n'),
      }],
    }),
  });
}

async function deleteSuggestion(id, env) {
  // Remove from KV
  await env.SUGGESTIONS.delete(`suggestion:${id}`);

  // Remove from index
  const index = JSON.parse(await env.SUGGESTIONS.get('index') || '[]');
  const newIndex = index.filter(i => i !== id);
  await env.SUGGESTIONS.put('index', JSON.stringify(newIndex));

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function getSuggestions(env) {
  const index = JSON.parse(await env.SUGGESTIONS.get('index') || '[]');
  const suggestions = [];

  // Return last 50 suggestions
  const recentIds = index.slice(-50);
  for (const id of recentIds) {
    const data = await env.SUGGESTIONS.get(`suggestion:${id}`);
    if (data) suggestions.push(JSON.parse(data));
  }

  return new Response(JSON.stringify({ suggestions: suggestions.reverse() }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function handleCors(request, response) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', allowedOrigin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400');

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
