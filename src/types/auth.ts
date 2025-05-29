export interface SecureStorage {
  storeCredential(
    pluginId: string,
    credentialId: string,
    value: string
  ): Promise<void>;
  retrieveCredential(
    pluginId: string,
    credentialId: string
  ): Promise<string | null>;
  deleteCredential(pluginId: string, credentialId: string): Promise<void>;
  listCredentials(pluginId: string): Promise<string[]>;
}

export interface EncryptedCredential {
  id: string;
  pluginId: string;
  credentialId: string;
  encryptedValue: string;
  iv: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticationResult {
  success: boolean;
  token?: string;
  expiresAt?: number;
  error?: string;
}

export interface ApiKeyAuth {
  type: "api-key";
  key: string;
  header?: string; // Default: "Authorization"
  prefix?: string; // Default: "Bearer"
}

export interface JwtAuth {
  type: "jwt";
  token: string;
  secret?: string;
  algorithm?: "HS256" | "HS384" | "HS512" | "RS256";
}

export interface CustomAuth {
  type: "custom";
  handler: string; // Function name or class reference
  config: Record<string, any>;
}

export type AuthConfig = ApiKeyAuth | JwtAuth | CustomAuth;

export interface AuthManager {
  authenticate(
    pluginId: string,
    config: AuthConfig
  ): Promise<AuthenticationResult>;
  validateToken(token: string): Promise<boolean>;
  refreshToken(pluginId: string): Promise<string | null>;
  revokeToken(pluginId: string): Promise<void>;
}
