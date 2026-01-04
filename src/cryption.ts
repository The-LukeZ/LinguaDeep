import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

export class Cryption {
  private key: Buffer;

  constructor(base64Secret: string) {
    // Decode base64 secret and ensure it's 32 bytes for AES-256
    const decoded = Buffer.from(base64Secret, "base64");
    if (decoded.length < 32) {
      // Pad if too short
      this.key = Buffer.concat([decoded, Buffer.alloc(32 - decoded.length)]);
    } else {
      // Truncate if too long
      this.key = decoded.subarray(0, 32);
    }
  }

  encrypt(text: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();

    // Combine IV + authTag + encrypted data and encode as base64
    const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, "hex")]);

    return combined.toString("base64");
  }

  decrypt(encryptedBase64: string): string {
    const combined = Buffer.from(encryptedBase64, "base64");
    const iv = combined.subarray(0, 16);
    const authTag = combined.subarray(16, 32);
    const encrypted = combined.subarray(32);

    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted.toString("hex"), "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}

export const makeCryptor = () => new Cryption(process.env.ENCRYPTION_KEY || "default_fallback_encryption_key_1234");
// If this default is used, I'm going to be very sad
