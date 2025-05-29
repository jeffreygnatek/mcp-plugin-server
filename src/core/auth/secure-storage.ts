import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { SecureStorage, EncryptedCredential } from "../../types/auth";

export class FileSecureStorage implements SecureStorage {
  private masterKey: Buffer;
  private storageDir: string;

  constructor(masterKey?: string, storageDir: string = "./data/credentials") {
    if (!masterKey) {
      throw new Error("Master key is required for secure storage");
    }

    this.masterKey = Buffer.from(masterKey, "hex");
    if (this.masterKey.length !== 32) {
      throw new Error("Master key must be 32 bytes (64 hex characters)");
    }

    this.storageDir = storageDir;
    this.ensureStorageDir();
  }

  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.promises.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      console.error("Failed to create storage directory:", error);
    }
  }

  private encrypt(plaintext: string): { encryptedValue: string; iv: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.masterKey, iv);
    cipher.setAAD(iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();
    const encryptedValue = encrypted + ":" + authTag.toString("hex");

    return {
      encryptedValue,
      iv: iv.toString("hex"),
    };
  }

  private decrypt(encryptedValue: string, iv: string): string {
    const [encrypted, authTagHex] = encryptedValue.split(":");
    if (!encrypted || !authTagHex) {
      throw new Error("Invalid encrypted value format");
    }

    const authTag = Buffer.from(authTagHex, "hex");
    const ivBuffer = Buffer.from(iv, "hex");

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      this.masterKey,
      ivBuffer
    );
    decipher.setAAD(ivBuffer);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  private getCredentialPath(pluginId: string): string {
    return path.join(this.storageDir, `${pluginId}.json`);
  }

  private async loadCredentials(
    pluginId: string
  ): Promise<Record<string, EncryptedCredential>> {
    const filePath = this.getCredentialPath(pluginId);

    try {
      const data = await fs.promises.readFile(filePath, "utf8");
      return JSON.parse(data);
    } catch (error) {
      if ((error as any).code === "ENOENT") {
        return {};
      }
      throw error;
    }
  }

  private async saveCredentials(
    pluginId: string,
    credentials: Record<string, EncryptedCredential>
  ): Promise<void> {
    const filePath = this.getCredentialPath(pluginId);
    await fs.promises.writeFile(filePath, JSON.stringify(credentials, null, 2));
  }

  async storeCredential(
    pluginId: string,
    credentialId: string,
    value: string
  ): Promise<void> {
    const credentials = await this.loadCredentials(pluginId);
    const { encryptedValue, iv } = this.encrypt(value);

    credentials[credentialId] = {
      id: `${pluginId}:${credentialId}`,
      pluginId,
      credentialId,
      encryptedValue,
      iv,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.saveCredentials(pluginId, credentials);
  }

  async retrieveCredential(
    pluginId: string,
    credentialId: string
  ): Promise<string | null> {
    const credentials = await this.loadCredentials(pluginId);
    const credential = credentials[credentialId];

    if (!credential) {
      return null;
    }

    try {
      return this.decrypt(credential.encryptedValue, credential.iv);
    } catch (error) {
      console.error(
        `Failed to decrypt credential ${credentialId} for plugin ${pluginId}:`,
        error
      );
      return null;
    }
  }

  async deleteCredential(
    pluginId: string,
    credentialId: string
  ): Promise<void> {
    const credentials = await this.loadCredentials(pluginId);
    delete credentials[credentialId];
    await this.saveCredentials(pluginId, credentials);
  }

  async listCredentials(pluginId: string): Promise<string[]> {
    const credentials = await this.loadCredentials(pluginId);
    return Object.keys(credentials);
  }

  static generateMasterKey(): string {
    return crypto.randomBytes(32).toString("hex");
  }
}
