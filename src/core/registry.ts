import * as fs from "fs";
import * as path from "path";
import {
  MCPPlugin,
  PluginConfig,
  PluginLoadResult,
  PluginStatus,
  PluginMetadata,
} from "../types/plugin";

export interface PluginRegistry {
  loadPlugin(pluginPath: string): Promise<PluginLoadResult>;
  unloadPlugin(pluginName: string): Promise<void>;
  getPlugin(name: string): MCPPlugin | null;
  listPlugins(): PluginStatus[];
  enablePlugin(name: string): Promise<void>;
  disablePlugin(name: string): Promise<void>;
  getPluginConfig(name: string): PluginConfig | null;
  updatePluginConfig(name: string, config: PluginConfig): Promise<void>;
}

interface LoadedPlugin {
  plugin: MCPPlugin;
  config: PluginConfig;
  metadata: PluginMetadata;
  initialized: boolean;
  enabled: boolean;
  error?: string;
}

export class FilePluginRegistry implements PluginRegistry {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private configPath: string;
  private pluginsDir: string;

  constructor(
    configPath: string = "./config/plugins.json",
    pluginsDir: string = "./plugins"
  ) {
    this.configPath = configPath;
    this.pluginsDir = pluginsDir;
  }

  async loadPlugin(pluginPath: string): Promise<PluginLoadResult> {
    try {
      // Resolve the full plugin path
      const fullPath = path.resolve(this.pluginsDir, pluginPath);

      // Check if plugin directory exists
      if (!fs.existsSync(fullPath)) {
        return {
          success: false,
          error: `Plugin path does not exist: ${fullPath}`,
        };
      }

      // Look for package.json or plugin manifest
      const packageJsonPath = path.join(fullPath, "package.json");
      const pluginJsonPath = path.join(fullPath, "plugin.json");

      let metadata: PluginMetadata;

      if (fs.existsSync(pluginJsonPath)) {
        const pluginManifest = JSON.parse(
          fs.readFileSync(pluginJsonPath, "utf8")
        );
        metadata = pluginManifest;
      } else if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf8")
        );
        metadata = {
          name: packageJson.name,
          version: packageJson.version,
          description: packageJson.description || "",
          author: packageJson.author,
          homepage: packageJson.homepage,
          dependencies: packageJson.dependencies
            ? Object.keys(packageJson.dependencies)
            : [],
        };
      } else {
        return {
          success: false,
          error: "No plugin.json or package.json found",
        };
      }

      // Try to load the plugin module
      const mainFile = path.join(fullPath, "index.js"); // Assume compiled JS
      if (!fs.existsSync(mainFile)) {
        return { success: false, error: `Main file not found: ${mainFile}` };
      }

      // Dynamic import of the plugin
      delete require.cache[require.resolve(mainFile)];
      const pluginModule = require(mainFile);

      // Get the plugin class or function
      const PluginClass = pluginModule.default || pluginModule;

      if (typeof PluginClass !== "function") {
        return {
          success: false,
          error: "Plugin must export a class or constructor function",
        };
      }

      // Create plugin instance
      const plugin: MCPPlugin = new PluginClass();

      // Validate plugin interface
      if (!this.validatePlugin(plugin)) {
        return {
          success: false,
          error: "Plugin does not implement required MCPPlugin interface",
        };
      }

      // Load existing config or create default
      const config = await this.loadPluginConfig(metadata.name);

      // Store the loaded plugin
      this.plugins.set(metadata.name, {
        plugin,
        config,
        metadata,
        initialized: false,
        enabled: config.enabled,
      });

      return { success: true, plugin };
    } catch (error) {
      return {
        success: false,
        error: `Failed to load plugin: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  private validatePlugin(plugin: any): plugin is MCPPlugin {
    return (
      typeof plugin.name === "string" &&
      typeof plugin.version === "string" &&
      typeof plugin.description === "string" &&
      typeof plugin.initialize === "function" &&
      typeof plugin.getTools === "function" &&
      typeof plugin.getResources === "function" &&
      typeof plugin.executeTool === "function" &&
      typeof plugin.cleanup === "function"
    );
  }

  async unloadPlugin(pluginName: string): Promise<void> {
    const loadedPlugin = this.plugins.get(pluginName);
    if (!loadedPlugin) {
      throw new Error(`Plugin ${pluginName} is not loaded`);
    }

    if (loadedPlugin.initialized) {
      try {
        await loadedPlugin.plugin.cleanup();
      } catch (error) {
        console.error(`Error cleaning up plugin ${pluginName}:`, error);
      }
    }

    this.plugins.delete(pluginName);
  }

  getPlugin(name: string): MCPPlugin | null {
    const loadedPlugin = this.plugins.get(name);
    return loadedPlugin?.plugin || null;
  }

  listPlugins(): PluginStatus[] {
    return Array.from(this.plugins.values()).map((loaded) => ({
      name: loaded.metadata.name,
      version: loaded.metadata.version,
      enabled: loaded.enabled,
      initialized: loaded.initialized,
      error: loaded.error,
      toolCount: loaded.initialized ? loaded.plugin.getTools().length : 0,
      resourceCount: loaded.initialized
        ? loaded.plugin.getResources().length
        : 0,
    }));
  }

  async enablePlugin(name: string): Promise<void> {
    const loadedPlugin = this.plugins.get(name);
    if (!loadedPlugin) {
      throw new Error(`Plugin ${name} is not loaded`);
    }

    loadedPlugin.enabled = true;
    loadedPlugin.config.enabled = true;
    await this.savePluginConfig(name, loadedPlugin.config);
  }

  async disablePlugin(name: string): Promise<void> {
    const loadedPlugin = this.plugins.get(name);
    if (!loadedPlugin) {
      throw new Error(`Plugin ${name} is not loaded`);
    }

    if (loadedPlugin.initialized) {
      await loadedPlugin.plugin.cleanup();
      loadedPlugin.initialized = false;
    }

    loadedPlugin.enabled = false;
    loadedPlugin.config.enabled = false;
    await this.savePluginConfig(name, loadedPlugin.config);
  }

  getPluginConfig(name: string): PluginConfig | null {
    const loadedPlugin = this.plugins.get(name);
    return loadedPlugin?.config || null;
  }

  async updatePluginConfig(name: string, config: PluginConfig): Promise<void> {
    const loadedPlugin = this.plugins.get(name);
    if (!loadedPlugin) {
      throw new Error(`Plugin ${name} is not loaded`);
    }

    loadedPlugin.config = config;
    await this.savePluginConfig(name, config);
  }

  private async loadPluginConfig(pluginName: string): Promise<PluginConfig> {
    try {
      const configData = fs.readFileSync(this.configPath, "utf8");
      const allConfigs = JSON.parse(configData);

      return (
        allConfigs[pluginName] || {
          enabled: false,
          config: {},
        }
      );
    } catch (error) {
      // Return default config if file doesn't exist or is invalid
      return {
        enabled: false,
        config: {},
      };
    }
  }

  private async savePluginConfig(
    pluginName: string,
    config: PluginConfig
  ): Promise<void> {
    let allConfigs: Record<string, PluginConfig> = {};

    try {
      const configData = fs.readFileSync(this.configPath, "utf8");
      allConfigs = JSON.parse(configData);
    } catch (error) {
      // File doesn't exist or is invalid, start with empty config
    }

    allConfigs[pluginName] = config;

    // Ensure config directory exists
    const configDir = path.dirname(this.configPath);
    fs.mkdirSync(configDir, { recursive: true });

    fs.writeFileSync(this.configPath, JSON.stringify(allConfigs, null, 2));
  }

  async discoverPlugins(): Promise<string[]> {
    try {
      if (!fs.existsSync(this.pluginsDir)) {
        return [];
      }

      const items = fs.readdirSync(this.pluginsDir, { withFileTypes: true });
      const pluginDirs = items
        .filter((item) => item.isDirectory())
        .map((item) => item.name);

      return pluginDirs;
    } catch (error) {
      console.error("Error discovering plugins:", error);
      return [];
    }
  }
}
