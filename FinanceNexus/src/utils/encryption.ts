const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

export class EncryptionUtils {
  private static key: CryptoKey | null = null;
  private static salt: Uint8Array | null = null;

  static generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  }

  static generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  }

  static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: ALGORITHM, length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  static async init(password: string, existingSalt?: string): Promise<void> {
    this.salt = existingSalt
      ? this.base64ToUint8Array(existingSalt)
      : this.generateSalt();
    
    this.key = await this.deriveKey(password, this.salt);
  }

  static getSaltBase64(): string {
    if (!this.salt) throw new Error('Encryption not initialized');
    return this.uint8ArrayToBase64(this.salt);
  }

  static async encrypt(data: string, iv?: Uint8Array): Promise<{ encrypted: string; iv: string }> {
    if (!this.key) throw new Error('Encryption not initialized');

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const ivValue = iv || this.generateIV();

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv: ivValue,
      },
      this.key,
      dataBuffer
    );

    return {
      encrypted: this.arrayBufferToBase64(encryptedBuffer),
      iv: this.uint8ArrayToBase64(ivValue),
    };
  }

  static async decrypt(encrypted: string, iv: string): Promise<string> {
    if (!this.key) throw new Error('Encryption not initialized');

    const encryptedBuffer = this.base64ToArrayBuffer(encrypted);
    const ivBuffer = this.base64ToUint8Array(iv);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: ivBuffer,
      },
      this.key,
      encryptedBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  }

  static async encryptObject<T>(obj: T): Promise<{ encrypted: string; iv: string }> {
    return this.encrypt(JSON.stringify(obj));
  }

  static async decryptObject<T>(encrypted: string, iv: string): Promise<T> {
    const decrypted = await this.decrypt(encrypted, iv);
    return JSON.parse(decrypted);
  }

  private static uint8ArrayToBase64(array: Uint8Array): string {
    return btoa(String.fromCharCode(...array));
  }

  private static base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    return this.uint8ArrayToBase64(bytes);
  }

  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    return this.base64ToUint8Array(base64).buffer;
  }

  static clearKey(): void {
    this.key = null;
    this.salt = null;
  }

  static isInitialized(): boolean {
    return this.key !== null;
  }
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return crypto.subtle.digest('SHA-256', data).then(hash => {
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  });
}
