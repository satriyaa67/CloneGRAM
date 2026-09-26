export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers },
  });
}

export function fail(status, error, extra = {}, headers = {}) {
  return json({ ok: false, error, ...extra }, status, headers);
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
