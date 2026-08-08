// GET /api/gh/authorize — start of the OAuth handshake.
// Redirects the popup to github.com/login/oauth/authorize with our client_id, a random
// state we bind to a cookie for CSRF protection, and the callback URL.

import { setCookie, STATE_COOKIE } from './_shared.js';

export function onRequestGet({ request, env }) {
  if (!env.GH_CLIENT_ID) return new Response('GH_CLIENT_ID not configured', { status: 500 });

  const state = crypto.randomUUID();
  const url = new URL(request.url);
  const callback = `${url.origin}/api/gh/callback`;

  const gh = new URL('https://github.com/login/oauth/authorize');
  gh.searchParams.set('client_id', env.GH_CLIENT_ID);
  gh.searchParams.set('redirect_uri', callback);
  gh.searchParams.set('scope', 'public_repo');
  gh.searchParams.set('state', state);
  gh.searchParams.set('allow_signup', 'true');

  const headers = new Headers({ Location: gh.toString() });
  setCookie(headers, STATE_COOKIE, state, { maxAge: 600 });

  return new Response(null, { status: 302, headers });
}
