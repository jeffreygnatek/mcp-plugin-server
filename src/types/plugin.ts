export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface Logger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

export interface OAuthToken {
  accessToken: string;
  refreshToken: string | undefined;
  expiresAt: number;
  scope: string;
  tokenType: "Bearer" | string;
}

export interface PluginContext {
  pluginId: string;
  config: any;
  logger: Logger;

  // Authentication methods
  getCredential(key: string): Promise<string | null>;
  setCredential(key: string, value: string): Promise<void>;

  // OAuth-specific methods
  getAccessToken(): Promise<string>;
  isAuthenticated(): Promise<boolean>;
  getTokenInfo(): Promise<OAuthToken | null>;
  requireReauth(): Promise<string>;
}

export interface MCPPlugin {
  name: string;
  version: string;
  description: string;
  dependencies?: string[];

  initialize(context: PluginContext): Promise<void>;
  getTools(): Tool[];
  getResources(): Resource[];
  executeTool(name: string, args: any): Promise<any>;
  cleanup(): Promise<void>;
}

export interface PluginConfig {
  enabled: boolean;
  config: Record<string, any>;
  auth?: PluginAuthConfig;
}

export interface PluginAuthConfig {
  type: "api-key" | "oauth2" | "jwt" | "custom";
  required: boolean;
  fields: {
    [key: string]: {
      type: "string" | "password" | "url";
      required: boolean;
      description: string;
      validation?: RegExp;
    };
  };
}

export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  homepage?: string;
  dependencies?: string[];
  auth?: PluginAuthConfig;
}

export interface PluginLoadResult {
  success: boolean;
  plugin?: MCPPlugin;
  error?: string;
}

export interface PluginStatus {
  name: string;
  version: string;
  enabled: boolean;
  initialized: boolean;
  error: string | undefined;
  toolCount: number;
  resourceCount: number;
}
