// Cloudflare Worker: Updates / Roadmap Log
// Public endpoint to read updates, admin endpoint to manage them.
// Deploy: npx wrangler deploy
//
// Required env vars (set via wrangler secret):
//   ADMIN_KEY - secret key for admin operations
//
// Admin usage (curl examples):
//   Add update:
//     curl -X POST https://updates.newtonmac.workers.dev/admin/updates \
//       -H "Authorization: Bearer YOUR_ADMIN_KEY" \
//       -H "Content-Type: application/json" \
//       -d '{"title":"New Feature","description":"Added surf tracker","status":"completed"}'
//
//   Delete update:
//     curl -X DELETE https://updates.newtonmac.workers.dev/admin/updates/UPDATE_ID \
//       -H "Authorization: Bearer YOUR_ADMIN_KEY"
//
//   Update status:
//     curl -X PATCH https://updates.newtonmac.workers.dev/admin/updates/UPDATE_ID \
//       -H "Authorization: Bearer YOUR_ADMIN_KEY" \
//       -H "Content-Type: application/json" \
//       -d '{"status":"in_progress"}'

const ALLOWED_ORIGINS = [
  'https://jmlsd.org',
  'https://www.jmlsd.org',
  'https://paddlepoint.org',
  'https://www.paddlepoint.org',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

// Valid statuses for updates
const VALID_STATUSES = ['planned', 'in_progress', 'completed'];

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return handleCors(request, new Response(null, { status: 204 }));
    }

    const url = new URL(request.url);

    try {
      // Public: list updates
      if (request.method === 'GET' && url.pathname === '/updates') {
        return handleCors(request, await getUpdates(env));
      }

      // Admin: add update
      if (request.method === 'POST' && url.pathname === '/admin/updates') {
        if (!isAdmin(request, env)) return handleCors(request, unauthorized());
        return handleCors(request, await addUpdate(request, env));
      }

      // Admin: patch update (change status/fields)
      const patchMatch = url.pathname.match(/^\/admin\/updates\/(.+)$/);
      if (request.method === 'PATCH' && patchMatch) {
        if (!isAdmin(request, env)) return handleCors(request, unauthorized());
        return handleCors(request, await patchUpdate(patchMatch[1], request, env));
      }

      // Admin: delete update
      const deleteMatch = url.pathname.match(/^\/admin\/updates\/(.+)$/);
      if (request.method === 'DELETE' && deleteMatch) {
        if (!isAdmin(request, env)) return handleCors(request, unauthorized());
        return handleCors(request, await deleteUpdate(deleteMatch[1], env));
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

function isAdmin(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '');
  return token && token === env.ADMIN_KEY;
}

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function getUpdates(env) {
  const index = JSON.parse(await env.UPDATES.get('index') || '[]');
  const updates = [];

  for (const id of index) {
    const data = await env.UPDATES.get(`update:${id}`);
    if (data) updates.push(JSON.parse(data));
  }

  // Return newest first
  return new Response(JSON.stringify({ updates: updates.reverse() }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function addUpdate(request, env) {
  const body = await request.json();
  const { title, description, status, suggestedBy } = body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Title is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const updateStatus = VALID_STATUSES.includes(status) ? status : 'planned';

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const update = {
    id,
    title: title.trim().slice(0, 200),
    description: (description || '').slice(0, 1000),
    suggestedBy: (suggestedBy || '').slice(0, 200),
    status: updateStatus,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await env.UPDATES.put(`update:${id}`, JSON.stringify(update));

  const index = JSON.parse(await env.UPDATES.get('index') || '[]');
  index.push(id);
  await env.UPDATES.put('index', JSON.stringify(index));

  return new Response(JSON.stringify({ success: true, update }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function patchUpdate(id, request, env) {
  const existing = await env.UPDATES.get(`update:${id}`);
  if (!existing) {
    return new Response(JSON.stringify({ error: 'Update not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const update = JSON.parse(existing);
  const body = await request.json();

  if (body.title) update.title = body.title.slice(0, 200);
  if (body.description !== undefined) update.description = body.description.slice(0, 1000);
  if (body.status && VALID_STATUSES.includes(body.status)) update.status = body.status;
  update.updatedAt = new Date().toISOString();

  await env.UPDATES.put(`update:${id}`, JSON.stringify(update));

  return new Response(JSON.stringify({ success: true, update }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function deleteUpdate(id, env) {
  const existing = await env.UPDATES.get(`update:${id}`);
  if (!existing) {
    return new Response(JSON.stringify({ error: 'Update not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await env.UPDATES.delete(`update:${id}`);

  const index = JSON.parse(await env.UPDATES.get('index') || '[]');
  const newIndex = index.filter(i => i !== id);
  await env.UPDATES.put('index', JSON.stringify(newIndex));

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function handleCors(request, response) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', allowedOrigin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400');

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
