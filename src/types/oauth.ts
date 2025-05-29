export interface OAuthConfig {
  provider: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  authorizationUrl: string;
  tokenUrl: string;
  redirectUri: string;
  pkce?: boolean;
}

export interface OAuthToken {
  accessToken: string;
  refreshToken: string | undefined;
  expiresAt: number;
  scope: string;
  tokenType: "Bearer" | string;
}

export interface OAuthState {
  pluginId: string;
  state: string;
  codeVerifier?: string; // For PKCE
  createdAt: number;
  expiresAt: number;
}

export interface OAuthManager {
  initiateFlow(
    pluginId: string,
    config: OAuthConfig
  ): Promise<{
    authUrl: string;
    state: string;
  }>;
  handleCallback(code: string, state: string): Promise<OAuthToken>;
  refreshToken(pluginId: string, refreshToken: string): Promise<OAuthToken>;
  revokeToken(pluginId: string): Promise<void>;
}

export interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}

export interface OAuthProvider {
  name: string;
  authorizationUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  userInfoUrl?: string;
  scopes: {
    [key: string]: string; // scope -> description
  };
}

export interface OAuthError {
  error: string;
  errorDescription?: string;
  errorUri?: string;
  state?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}
