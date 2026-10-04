import { env } from "cloudflare:workers";
import { requestUserId } from "./identity";
import { permittedApiKey } from "./paid-api-policy";

export function userId(request: Request) {
  const id = requestUserId(request, import.meta.env.DEV);
  if (!id) throw new Error("Authentification requise.");
  return id;
}

export function runtimeValue(name: string) {
  const value = (env as unknown as Record<string, unknown>)[name];
  if (name === 'OPENAI_API_KEY') return permittedApiKey(value, (env as unknown as Record<string, unknown>).MORICE_ALLOW_PAID_API);
  return typeof value === "string" ? value.trim() : "";
}

export const now = () => new Date().toISOString();
