/**
 * Client-side cryptographic helper using standard browser Web Crypto API.
 * This guarantees zero-knowledge encryption: private decision details are encrypted
 * before they are synchronized with the Firestore database.
 */

// Helper to convert ArrayBuffer to Hex string
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper to convert Hex string to Uint8Array
function hexToBuffer(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) return new Uint8Array();
  return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}

/**
 * Derives an AES-GCM 256 key from a plain text password and salt using PBKDF2.
 */
export async function deriveKey(password: string, saltHex: string): Promise<CryptoKey> {
  const salt = hexToBuffer(saltHex);
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Import the password as raw key material
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive the actual AES-GCM 256-bit key
  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a string using AES-GCM 256.
 */
export async function encryptText(
  text: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  // Generate a random 12-byte initialization vector (IV)
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    data
  );

  return {
    ciphertext: bufferToHex(encryptedBuffer),
    iv: bufferToHex(iv)
  };
}

/**
 * Decrypts a string using AES-GCM 256.
 */
export async function decryptText(
  ciphertextHex: string,
  ivHex: string,
  key: CryptoKey
): Promise<string> {
  const ciphertext = hexToBuffer(ciphertextHex);
  const iv = hexToBuffer(ivHex);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Generates a random salt in Hex format.
 */
export function generateSaltHex(): string {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  return bufferToHex(salt);
}
