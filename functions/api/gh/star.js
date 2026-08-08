// POST /api/gh/star — star the repo on behalf of the signed-in user.
// DELETE /api/gh/star — unstar it.
// Both use the token from the HttpOnly cookie set by /api/gh/callback.

import { getCookie, TOKEN_COOKIE, REPO, ghHeaders } from './_shared.js';

// Cloudflare Pages Functions route by method-specific handler name — a generic onRequest
// exists but the runtime returns 405 for methods without a matching handler unless the
// generic one is the only one exported. Explicit onRequestPost/onRequestDelete is the
// safer, self-documenting shape.

export const onRequestPost = (ctx) => toggleStar(ctx, 'PUT');
export const onRequestDelete = (ctx) => toggleStar(ctx, 'DELETE');

async function toggleStar({ request }, method) {
  const token = getCookie(request, TOKEN_COOKIE);
  if (!token) return Response.json({ error: 'not_authenticated' }, { status: 401 });

  const starRes = await fetch(`https://api.github.com/user/starred/${REPO}`, {
    method,
    headers: { ...ghHeaders(token), 'Content-Length': '0' },
  });

  if (!starRes.ok && starRes.status !== 204) {
    return Response.json({ error: 'github_rejected', status: starRes.status }, { status: 502 });
  }

  const repoRes = await fetch(`https://api.github.com/repos/${REPO}`, { headers: ghHeaders(token) });
  const repo = repoRes.ok ? await repoRes.json() : null;

  return Response.json({
    starred: method === 'PUT',
    stars: repo?.stargazers_count ?? null,
  });
}
