/** Normalize service URL from env (supports bare Render/Railway hostnames). */
export function serviceUrl(value: string | undefined, fallback: string): string {
  const raw = (value ?? fallback).trim();
  if (!raw) return fallback;

  let host: string;
  let scheme = "https";

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const parsed = new URL(raw);
      host = parsed.host;
      scheme = parsed.protocol.replace(":", "");
    } catch {
      return fallback;
    }
  } else {
    host = raw.replace(/\/$/, "");
  }

  if (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.includes(".railway.internal")
  ) {
    return `http://${host}`;
  }

  // Render blueprint `property: host` yields private names like "conveyx-sku" (with or without https://).
  const hostname = host.split(":")[0] ?? host;
  if (!hostname.includes(".")) {
    host = `${hostname}.onrender.com`;
    scheme = "https";
  }

  return `${scheme}://${host}`;
}
