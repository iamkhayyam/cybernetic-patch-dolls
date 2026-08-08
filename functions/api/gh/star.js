// POST /api/gh/star — star the repo on behalf of the signed-in user.
// DELETE /api/gh/star — unstar it.
// Both use the token from the HttpOnly cookie set by /api/gh/callback.

import { getCookie, TOKEN_COOKIE, REPO, ghHeaders } from './_shared.js';

export async function onRequest({ request }) {
  if (request.method !== 'POST' && request.method !== 'DELETE') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST, DELETE' } });
  }

  const token = getCookie(request, TOKEN_COOKIE);
  if (!token) return Response.json({ error: 'not_authenticated' }, { status: 401 });

  const method = request.method === 'DELETE' ? 'DELETE' : 'PUT';
  const starRes = await fetch(`https://api.github.com/user/starred/${REPO}`, {
    method,
    headers: { ...ghHeaders(token), 'Content-Length': '0' },
  });

  if (!starRes.ok && starRes.status !== 204) {
    return Response.json({ error: 'github_rejected', status: starRes.status }, { status: 502 });
  }

  // Refresh the count so the client can update the badge inline.
  const repoRes = await fetch(`https://api.github.com/repos/${REPO}`, { headers: ghHeaders(token) });
  const repo = repoRes.ok ? await repoRes.json() : null;

  return Response.json({
    starred: method === 'PUT',
    stars: repo?.stargazers_count ?? null,
  });
}
