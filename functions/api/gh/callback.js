// GET /api/gh/callback — GitHub redirects here after the user approves.
// Verifies state, trades the code for an access token, sets it as an HttpOnly cookie,
// then closes the popup and notifies the opener via postMessage.

import { getCookie, setCookie, clearCookie, STATE_COOKIE, TOKEN_COOKIE, UA } from './_shared.js';

export async function onRequestGet({ request, env }) {
  if (!env.GH_CLIENT_ID || !env.GH_CLIENT_SECRET) {
    return htmlResponse(500, errorPage('OAuth is not configured. Missing GH_CLIENT_ID or GH_CLIENT_SECRET.'));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = getCookie(request, STATE_COOKIE);

  if (!code) return htmlResponse(400, errorPage('OAuth callback missing code.'));
  if (!state || !cookieState || state !== cookieState) {
    return htmlResponse(400, errorPage('OAuth state mismatch. Try again from the site.'));
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({
      client_id: env.GH_CLIENT_ID,
      client_secret: env.GH_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/api/gh/callback`,
    }),
  });

  if (!tokenRes.ok) return htmlResponse(502, errorPage(`GitHub token exchange failed: ${tokenRes.status}`));
  const body = await tokenRes.json();
  if (!body.access_token) return htmlResponse(502, errorPage(`GitHub declined the token exchange: ${body.error_description || body.error || 'unknown error'}`));

  const headers = new Headers({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  setCookie(headers, TOKEN_COOKIE, body.access_token, { maxAge: 60 * 60 * 24 * 7 });
  clearCookie(headers, STATE_COOKIE);

  return new Response(closePage(url.origin), { status: 200, headers });
}

function htmlResponse(status, html) {
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

function closePage(origin) {
  return `<!doctype html><meta charset="utf-8"><title>Signed in</title>
<style>body{background:#161513;color:#e5e0d3;font:14px/1.4 ui-sans-serif,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}</style>
<p>Signed in. This window can close.</p>
<script>
  try {
    if (window.opener) {
      window.opener.postMessage({ source: 'gh-oauth', ok: true }, ${JSON.stringify(origin)});
      window.close();
    }
  } catch (e) {}
  setTimeout(() => { if (!window.closed) location.href = '/'; }, 1500);
</script>`;
}

function errorPage(msg) {
  return `<!doctype html><meta charset="utf-8"><title>Sign-in error</title>
<style>body{background:#161513;color:#e5e0d3;font:14px/1.5 ui-sans-serif,system-ui,sans-serif;padding:40px;margin:0}code{color:#f0a08a}</style>
<h1 style="font-size:1.2rem;margin:0 0 12px">Sign-in couldn't complete</h1>
<p>${msg.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</p>
<script>
  try { if (window.opener) window.opener.postMessage({ source: 'gh-oauth', ok: false }, '*'); } catch (e) {}
</script>`;
}
