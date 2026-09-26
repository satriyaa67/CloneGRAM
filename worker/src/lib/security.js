const encoder = new TextEncoder();

/** Constant-time string comparison (length difference is folded into the result). */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length === 0) return false;
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function bearerToken(request) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '');
  return match ? match[1].trim() : null;
}
