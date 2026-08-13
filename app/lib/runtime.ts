import { env } from "cloudflare:workers";

export function userId(request: Request) {
  return request.headers.get("oai-authenticated-user-id") || "alan";
}

export function runtimeValue(name: string) {
  const value = (env as unknown as Record<string, unknown>)[name];
  return typeof value === "string" ? value.trim() : "";
}

export const now = () => new Date().toISOString();
