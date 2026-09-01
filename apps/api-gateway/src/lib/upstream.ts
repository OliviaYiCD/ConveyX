/** Normalize service URL from env (supports bare Render/Railway hostnames). */
export function serviceUrl(value: string | undefined, fallback: string): string {
  const raw = (value ?? fallback).trim();
  if (!raw) return fallback;

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw.replace(/\/$/, "");
  }

  let host = raw.replace(/\/$/, "");
  if (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.includes(".railway.internal")
  ) {
    return `http://${host}`;
  }

  // Render blueprint `property: host` returns private network names like "conveyx-sku".
  if (!host.includes(".")) {
    host = `${host}.onrender.com`;
  }

  return `https://${host}`;
}
