// GET /api/gh/status — is this browser signed in, and has that user already starred?
// Response: { authenticated: bool, starred: bool, stars: number|null }

import { getCookie, TOKEN_COOKIE, REPO, ghHeaders } from './_shared.js';

export async function onRequestGet({ request }) {
  const token = getCookie(request, TOKEN_COOKIE);
  const repoRes = await fetch(`https://api.github.com/repos/${REPO}`, { headers: ghHeaders() });
  const repo = repoRes.ok ? await repoRes.json() : null;
  const stars = repo?.stargazers_count ?? null;

  if (!token) return Response.json({ authenticated: false, starred: false, stars });

  const starredRes = await fetch(`https://api.github.com/user/starred/${REPO}`, { headers: ghHeaders(token) });
  // 204 = starred, 404 = not starred, 401 = invalid token.
  return Response.json({
    authenticated: starredRes.status !== 401,
    starred: starredRes.status === 204,
    stars,
  });
}
