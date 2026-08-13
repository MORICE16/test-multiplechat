import { runtimeValue } from "./runtime";

function encryptionKeyBytes() {
  const encoded = runtimeValue("MORICE_ENCRYPTION_KEY");
  if (!encoded) throw new Error("La clé de chiffrement Morice n’est pas configurée.");
  const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
  if (bytes.byteLength !== 32) throw new Error("La clé de chiffrement Morice doit contenir 32 octets.");
  return bytes;
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function encryptSecret(value: string) {
  const key = await crypto.subtle.importKey("raw", encryptionKeyBytes(), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  return `${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;
}

export async function decryptSecret(value: string) {
  const [ivText, encryptedText] = value.split(".");
  if (!ivText || !encryptedText) throw new Error("Jeton Microsoft invalide.");
  const iv = Uint8Array.from(atob(ivText), character => character.charCodeAt(0));
  const encrypted = Uint8Array.from(atob(encryptedText), character => character.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", encryptionKeyBytes(), "AES-GCM", false, ["decrypt"]);
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
  return new TextDecoder().decode(clear);
}
