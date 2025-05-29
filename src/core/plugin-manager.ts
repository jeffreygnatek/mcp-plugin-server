import { PluginContext, Logger, Tool, Resource } from "../types/plugin";
import { SecureStorage } from "../types/auth";
import { OAuthToken } from "../types/oauth";
import { PluginRegistry } from "./registry";

class PluginLogger implements Logger {
  constructor(private pluginId: string) {}

  info(message: string, ...args: any[]): void {
    console.log(`[${this.pluginId}] INFO:`, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[${this.pluginId}] WARN:`, message, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[${this.pluginId}] ERROR:`, message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    console.debug(`[${this.pluginId}] DEBUG:`, message, ...args);
  }
}

class PluginContextImpl implements PluginContext {
  public logger: Logger;

  constructor(
    public pluginId: string,
    public config: any,
    private secureStorage: SecureStorage
  ) {
    this.logger = new PluginLogger(pluginId);
  }

  async getCredential(key: string): Promise<string | null> {
    return await this.secureStorage.retrieveCredential(this.pluginId, key);
  }

  async setCredential(key: string, value: string): Promise<void> {
    await this.secureStorage.storeCredential(this.pluginId, key, value);
  }

  // OAuth methods - to be implemented when OAuth manager is available
  async getAccessToken(): Promise<string> {
    const token = await this.getCredential("access_token");
    if (!token) {
      throw new Error("No access token available");
    }
    return token;
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getCredential("access_token");
    return token !== null;
  }

  async getTokenInfo(): Promise<OAuthToken | null> {
    const accessToken = await this.getCredential("access_token");
    const refreshToken = await this.getCredential("refresh_token");
    const expiresAt = await this.getCredential("expires_at");
    const scope = await this.getCredential("scope");
    const tokenType = await this.getCredential("token_type");

    if (!accessToken) {
      return null;
    }

    return {
      accessToken,
      refreshToken: refreshToken || undefined,
      expiresAt: expiresAt ? parseInt(expiresAt, 10) : Date.now() + 3600000, // Default 1 hour
      scope: scope || "",
      tokenType: (tokenType as "Bearer") || "Bearer",
    };
  }

  async requireReauth(): Promise<string> {
    // This would trigger a re-authentication flow
    // For now, just throw an error indicating re-auth is needed
    throw new Error(
      "Re-authentication required. Please use the OAuth flow to re-authenticate."
    );
  }
}

export interface PluginManager {
  initializePlugin(pluginName: string): Promise<void>;
  initializeAllPlugins(): Promise<void>;
  getAvailableTools(): Tool[];
  getAvailableResources(): Resource[];
  executeTool(pluginName: string, toolName: string, args: any): Promise<any>;
  shutdownPlugin(pluginName: string): Promise<void>;
  shutdownAllPlugins(): Promise<void>;
}

export class DefaultPluginManager implements PluginManager {
  private initializedPlugins: Set<string> = new Set();

  constructor(
    private registry: PluginRegistry,
    private secureStorage: SecureStorage
  ) {}

  async initializePlugin(pluginName: string): Promise<void> {
    const plugin = this.registry.getPlugin(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} not found`);
    }

    const config = this.registry.getPluginConfig(pluginName);
    if (!config?.enabled) {
      throw new Error(`Plugin ${pluginName} is not enabled`);
    }

    if (this.initializedPlugins.has(pluginName)) {
      return; // Already initialized
    }

    const context = new PluginContextImpl(
      pluginName,
      config.config,
      this.secureStorage
    );

    try {
      await plugin.initialize(context);
      this.initializedPlugins.add(pluginName);
      context.logger.info("Plugin initialized successfully");
    } catch (error) {
      context.logger.error("Failed to initialize plugin:", error);
      throw error;
    }
  }

  async initializeAllPlugins(): Promise<void> {
    const plugins = this.registry.listPlugins();
    const enabledPlugins = plugins.filter((p) => p.enabled);

    // Initialize plugins in dependency order (basic implementation)
    const initPromises = enabledPlugins.map(async (pluginStatus) => {
      try {
        await this.initializePlugin(pluginStatus.name);
      } catch (error) {
        console.error(
          `Failed to initialize plugin ${pluginStatus.name}:`,
          error
        );
      }
    });

    await Promise.all(initPromises);
  }

  getAvailableTools(): Tool[] {
    const allTools: Tool[] = [];

    for (const pluginName of this.initializedPlugins) {
      const plugin = this.registry.getPlugin(pluginName);
      if (plugin) {
        try {
          const tools = plugin.getTools();
          // Prefix tool names with plugin name to avoid conflicts
          const prefixedTools = tools.map((tool) => ({
            ...tool,
            name: `${pluginName}.${tool.name}`,
          }));
          allTools.push(...prefixedTools);
        } catch (error) {
          console.error(
            `Error getting tools from plugin ${pluginName}:`,
            error
          );
        }
      }
    }

    return allTools;
  }

  getAvailableResources(): Resource[] {
    const allResources: Resource[] = [];

    for (const pluginName of this.initializedPlugins) {
      const plugin = this.registry.getPlugin(pluginName);
      if (plugin) {
        try {
          const resources = plugin.getResources();
          allResources.push(...resources);
        } catch (error) {
          console.error(
            `Error getting resources from plugin ${pluginName}:`,
            error
          );
        }
      }
    }

    return allResources;
  }

  async executeTool(
    pluginName: string,
    toolName: string,
    args: any
  ): Promise<any> {
    const plugin = this.registry.getPlugin(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} not found`);
    }

    if (!this.initializedPlugins.has(pluginName)) {
      throw new Error(`Plugin ${pluginName} is not initialized`);
    }

    try {
      return await plugin.executeTool(toolName, args);
    } catch (error) {
      console.error(
        `Error executing tool ${toolName} from plugin ${pluginName}:`,
        error
      );
      throw error;
    }
  }

  async shutdownPlugin(pluginName: string): Promise<void> {
    const plugin = this.registry.getPlugin(pluginName);
    if (!plugin) {
      return; // Plugin not found, nothing to shutdown
    }

    if (!this.initializedPlugins.has(pluginName)) {
      return; // Plugin not initialized, nothing to shutdown
    }

    try {
      await plugin.cleanup();
      this.initializedPlugins.delete(pluginName);
      console.log(`Plugin ${pluginName} shut down successfully`);
    } catch (error) {
      console.error(`Error shutting down plugin ${pluginName}:`, error);
      throw error;
    }
  }

  async shutdownAllPlugins(): Promise<void> {
    const shutdownPromises = Array.from(this.initializedPlugins).map(
      async (pluginName) => {
        try {
          await this.shutdownPlugin(pluginName);
        } catch (error) {
          console.error(`Failed to shutdown plugin ${pluginName}:`, error);
        }
      }
    );

    await Promise.all(shutdownPromises);
  }
}
