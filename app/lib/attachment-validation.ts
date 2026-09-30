export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_ATTACHMENTS = 3;
export function detectFile(bytes: Uint8Array): string {
  if (bytes.length > MAX_FILE_BYTES || bytes.length < 8) throw new Error('Fichier vide, invalide ou supérieur à 4 Mo.');
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if ([137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n)) return 'image/png';
  const head = new TextDecoder().decode(bytes.slice(0,12));
  if (head.startsWith('%PDF-')) return 'application/pdf';
  if (head.startsWith('RIFF') && head.slice(8,12) === 'WEBP') return 'image/webp';
  throw new Error('Formats acceptés : JPEG, PNG, WebP et PDF.');
}
export function safeFilename(value: string) {
  return value.replace(/[\x00-\x1f\x7f/\\<>:"|?*]/g, '_').slice(0,120) || 'document';
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}
