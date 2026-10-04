// Disabled by default. Existing secrets are retained but cannot fund requests.
export function permittedApiKey(key: unknown, consent: unknown): string {
  return consent === 'true' && typeof key === 'string' ? key.trim() : '';
}
