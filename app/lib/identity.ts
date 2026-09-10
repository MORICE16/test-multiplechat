/** Identity headers are trusted only behind the authenticated Sites gateway. */
export function requestUserId(request: Request, localDevelopment = false): string | null {
  const id = request.headers.get("oai-authenticated-user-id")?.trim();
  if (id) return id;
  if (!localDevelopment) return null;
  const url = new URL(request.url);
  const host = request.headers.get("host");
  const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
  // A forwarded/public request must never inherit the local data namespace.
  if (!loopback.has(url.hostname) || (host && host !== url.host)) return null;
  if (request.headers.has("forwarded") || request.headers.has("x-forwarded-for")) return null;
  // Vinext adds this header even for direct local requests; it must match exactly.
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost && forwardedHost !== url.host) return null;
  return "alan";
}
