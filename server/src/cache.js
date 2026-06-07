const store = new Map();

export async function cached(key, ttlMs, loader) {
  const now = Date.now();
  const existing = store.get(key);
  if (existing && existing.expiresAt > now) {
    return existing.value;
  }

  const value = await loader();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export function clearCache() {
  store.clear();
}
