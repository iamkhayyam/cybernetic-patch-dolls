// GET /api/gh/status — is this browser signed in, and has that user already starred?
// Response: { authenticated: bool, starred: bool }
//
// Deliberately does NOT return the star count. All Cloudflare Workers share outbound IPs,
// so an unauthenticated `api.github.com` call from here burns the 60/hr rate limit for
// every visitor at once. The count is fetched client-side (each visitor's own IP → their
// own 60/hr budget). This endpoint only does the auth check, which uses the visitor's
// personal OAuth token when present and therefore gets the 5000/hr authenticated budget.

import { getCookie, TOKEN_COOKIE, REPO, ghHeaders } from './_shared.js';

export async function onRequestGet({ request }) {
  const token = getCookie(request, TOKEN_COOKIE);
  if (!token) return Response.json({ authenticated: false, starred: false });

  const starredRes = await fetch(`https://api.github.com/user/starred/${REPO}`, { headers: ghHeaders(token) });
  // 204 = starred, 404 = not starred, 401 = invalid/expired token.
  if (starredRes.status === 401) return Response.json({ authenticated: false, starred: false });
  return Response.json({
    authenticated: true,
    starred: starredRes.status === 204,
  });
}
