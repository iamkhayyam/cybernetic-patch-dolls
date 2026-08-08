// Shared helpers for the GitHub OAuth + star endpoints.
// Cloudflare Pages Functions can import from within the functions/ tree.

export const REPO = 'iamkhayyam/cybernetic-patch-dolls';

// Cookie names — HttpOnly, Secure, SameSite=Lax throughout. Token is a public_repo-scoped
// user token; low blast radius if somehow leaked, but we still restrict it.
export const TOKEN_COOKIE = 'gh_token';
export const STATE_COOKIE = 'gh_state';

export function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  for (const raw of cookie.split(';')) {
    const c = raw.trim();
    if (c.startsWith(name + '=')) return decodeURIComponent(c.slice(name.length + 1));
  }
  return null;
}

export function setCookie(headers, name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/'];
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  headers.append('Set-Cookie', parts.join('; '));
}

export function clearCookie(headers, name) {
  setCookie(headers, name, '', { maxAge: 0 });
}

// A single User-Agent so GitHub knows who's calling — API rejects requests without one.
export const UA = 'cybernetic-patch-dolls/1.0 (+https://cybernetic-patch-dolls.pages.dev)';

export function ghHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': UA,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
