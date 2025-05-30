import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Tool, Resource, Prompt } from "@modelcontextprotocol/sdk/types.js";
import path from "path";
import fs from "fs/promises";

export interface PluginProcessConfig {
  name: string;
  path: string;
  maxMemory?: string;
  timeout?: number;
  restartPolicy?: "always" | "on-failure" | "never";
  maxRestarts?: number;
  dependencies?: string[];
}

export interface PluginProcess {
  config: PluginProcessConfig;
  process: ChildProcess | null;
  client: Client | null;
  transport: StdioClientTransport | null;
  status: "starting" | "running" | "stopping" | "stopped" | "failed";
  restartCount: number;
  lastRestart: Date | null;
  tools: Tool[];
  resources: Resource[];
  prompts: Prompt[];
}

export class ProcessManager extends EventEmitter {
  private plugins: Map<string, PluginProcess> = new Map();
  private readonly maxRestarts: number;
  private readonly restartDelay: number;
  private readonly healthCheckInterval: number;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(
    options: {
      maxRestarts?: number;
      restartDelay?: number;
      healthCheckInterval?: number;
    } = {}
  ) {
    super();
    this.maxRestarts = options.maxRestarts ?? 3;
    this.restartDelay = options.restartDelay ?? 1000;
    this.healthCheckInterval = options.healthCheckInterval ?? 30000;
  }

  async discoverPlugins(
    pluginsDir: string = "plugins"
  ): Promise<PluginProcessConfig[]> {
    const configs: PluginProcessConfig[] = [];

    try {
      const entries = await fs.readdir(pluginsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginPath = path.join(pluginsDir, entry.name);
          const configPath = path.join(pluginPath, "plugin.json");
          const packagePath = path.join(pluginPath, "package.json");

          try {
            // Check if plugin.json exists
            const configContent = await fs.readFile(configPath, "utf-8");
            const config = JSON.parse(configContent);

            // Load package.json for dependencies
            let dependencies: string[] = [];
            try {
              const packageContent = await fs.readFile(packagePath, "utf-8");
              const packageJson = JSON.parse(packageContent);
              dependencies = Object.keys(packageJson.dependencies || {});
            } catch (err) {
              console.warn(
                `Could not read package.json for plugin ${entry.name}`
              );
            }

            configs.push({
              name: entry.name,
              path: pluginPath,
              maxMemory: config.process?.maxMemory ?? "256MB",
              timeout: config.process?.timeout ?? 30000,
              restartPolicy: config.process?.restartPolicy ?? "on-failure",
              maxRestarts: config.process?.maxRestarts ?? this.maxRestarts,
              dependencies,
            });
          } catch (err) {
            console.warn(`Skipping plugin ${entry.name}: ${err}`);
          }
        }
      }
    } catch (err) {
      console.error(`Failed to discover plugins: ${err}`);
    }

    return configs;
  }

  async startPlugin(config: PluginProcessConfig): Promise<void> {
    if (this.plugins.has(config.name)) {
      throw new Error(`Plugin ${config.name} is already managed`);
    }

    const plugin: PluginProcess = {
      config,
      process: null,
      client: null,
      transport: null,
      status: "starting",
      restartCount: 0,
      lastRestart: null,
      tools: [],
      resources: [],
      prompts: [],
    };

    this.plugins.set(config.name, plugin);
    await this.spawnPluginProcess(plugin);
  }

  private async spawnPluginProcess(plugin: PluginProcess): Promise<void> {
    const wrapperPath = path.join(__dirname, "plugin-wrapper.js");
    const pluginPath = path.join(plugin.config.path, "index.ts");

    // Spawn the plugin process
    plugin.process = spawn("node", [wrapperPath, pluginPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        PLUGIN_NAME: plugin.config.name,
        PLUGIN_PATH: plugin.config.path,
      },
    });

    if (!plugin.process.stdin || !plugin.process.stdout) {
      throw new Error(
        `Failed to create stdio streams for plugin ${plugin.config.name}`
      );
    }

    // Set up transport and client
    plugin.transport = new StdioClientTransport({
      command: "node",
      args: [wrapperPath, pluginPath],
      env: {
        ...process.env,
        PLUGIN_NAME: plugin.config.name,
        PLUGIN_PATH: plugin.config.path,
      },
    });

    plugin.client = new Client({
      name: `plugin-manager-${plugin.config.name}`,
      version: "1.0.0",
    });

    // Handle process events
    plugin.process.on("error", (error) => {
      console.error(`Plugin ${plugin.config.name} process error:`, error);
      this.handlePluginFailure(plugin);
    });

    plugin.process.on("exit", (code, signal) => {
      console.log(
        `Plugin ${plugin.config.name} exited with code ${code}, signal ${signal}`
      );
      plugin.status = code === 0 ? "stopped" : "failed";
      this.handlePluginFailure(plugin);
    });

    // Connect to the plugin
    try {
      await plugin.client.connect(plugin.transport);
      await this.loadPluginCapabilities(plugin);
      plugin.status = "running";

      this.emit("pluginStarted", plugin.config.name, plugin);
      console.log(`Plugin ${plugin.config.name} started successfully`);
    } catch (error) {
      console.error(
        `Failed to connect to plugin ${plugin.config.name}:`,
        error
      );
      plugin.status = "failed";
      this.handlePluginFailure(plugin);
    }
  }

  private async loadPluginCapabilities(plugin: PluginProcess): Promise<void> {
    if (!plugin.client) return;

    try {
      // Load tools
      const toolsResult = await plugin.client.listTools();
      plugin.tools = toolsResult.tools || [];

      // Load resources
      const resourcesResult = await plugin.client.listResources();
      plugin.resources = resourcesResult.resources || [];

      // Load prompts
      const promptsResult = await plugin.client.listPrompts();
      plugin.prompts = promptsResult.prompts || [];

      console.log(
        `Loaded capabilities for ${plugin.config.name}: ${plugin.tools.length} tools, ${plugin.resources.length} resources, ${plugin.prompts.length} prompts`
      );
    } catch (error) {
      console.error(
        `Failed to load capabilities for plugin ${plugin.config.name}:`,
        error
      );
      throw error;
    }
  }

  private async handlePluginFailure(plugin: PluginProcess): Promise<void> {
    plugin.status = "failed";

    // Clean up client connection
    if (plugin.client) {
      try {
        await plugin.client.close();
      } catch (err) {
        console.warn(
          `Error closing client for plugin ${plugin.config.name}:`,
          err
        );
      }
      plugin.client = null;
    }

    plugin.transport = null;
    plugin.process = null;

    // Determine if we should restart
    const shouldRestart =
      plugin.config.restartPolicy === "always" ||
      (plugin.config.restartPolicy === "on-failure" &&
        plugin.restartCount < (plugin.config.maxRestarts ?? this.maxRestarts));

    if (shouldRestart) {
      plugin.restartCount++;
      plugin.lastRestart = new Date();

      console.log(
        `Restarting plugin ${plugin.config.name} (attempt ${plugin.restartCount})`
      );

      setTimeout(async () => {
        try {
          await this.spawnPluginProcess(plugin);
        } catch (error) {
          console.error(
            `Failed to restart plugin ${plugin.config.name}:`,
            error
          );
          this.emit("pluginFailed", plugin.config.name, error);
        }
      }, this.restartDelay);
    } else {
      console.log(`Plugin ${plugin.config.name} will not be restarted`);
      this.emit(
        "pluginFailed",
        plugin.config.name,
        new Error("Max restarts exceeded")
      );
    }
  }

  async stopPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} is not managed`);
    }

    plugin.status = "stopping";

    // Close MCP client connection
    if (plugin.client) {
      try {
        await plugin.client.close();
      } catch (err) {
        console.warn(`Error closing client for plugin ${name}:`, err);
      }
    }

    // Terminate the process
    if (plugin.process && !plugin.process.killed) {
      plugin.process.kill("SIGTERM");

      // Force kill after timeout
      setTimeout(() => {
        if (plugin.process && !plugin.process.killed) {
          plugin.process.kill("SIGKILL");
        }
      }, plugin.config.timeout ?? 30000);
    }

    plugin.status = "stopped";
    this.emit("pluginStopped", name);
  }

  async restartPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} is not managed`);
    }

    await this.stopPlugin(name);

    // Wait a bit for cleanup
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Reset restart count for manual restarts
    plugin.restartCount = 0;
    await this.spawnPluginProcess(plugin);
  }

  getAllTools(): Tool[] {
    const allTools: Tool[] = [];

    for (const [pluginName, plugin] of this.plugins) {
      if (plugin.status === "running") {
        // Namespace tools with plugin name
        const namespacedTools = plugin.tools.map((tool) => ({
          ...tool,
          name: `${pluginName}.${tool.name}`,
        }));
        allTools.push(...namespacedTools);
      }
    }

    return allTools;
  }

  getAllResources(): Resource[] {
    const allResources: Resource[] = [];

    for (const plugin of this.plugins.values()) {
      if (plugin.status === "running") {
        allResources.push(...plugin.resources);
      }
    }

    return allResources;
  }

  getAllPrompts(): Prompt[] {
    const allPrompts: Prompt[] = [];

    for (const [pluginName, plugin] of this.plugins) {
      if (plugin.status === "running") {
        // Namespace prompts with plugin name
        const namespacedPrompts = plugin.prompts.map((prompt) => ({
          ...prompt,
          name: `${pluginName}.${prompt.name}`,
        }));
        allPrompts.push(...namespacedPrompts);
      }
    }

    return allPrompts;
  }

  async executeToolInPlugin(
    pluginName: string,
    toolName: string,
    args: any
  ): Promise<any> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} not found`);
    }

    if (plugin.status !== "running" || !plugin.client) {
      throw new Error(`Plugin ${pluginName} is not running`);
    }

    try {
      return await plugin.client.callTool({
        name: toolName,
        arguments: args,
      });
    } catch (error) {
      console.error(
        `Error executing tool ${toolName} in plugin ${pluginName}:`,
        error
      );
      throw error;
    }
  }

  getPluginStatus(): Record<string, any> {
    const status: Record<string, any> = {};

    for (const [name, plugin] of this.plugins) {
      status[name] = {
        status: plugin.status,
        restartCount: plugin.restartCount,
        lastRestart: plugin.lastRestart,
        toolCount: plugin.tools.length,
        resourceCount: plugin.resources.length,
        promptCount: plugin.prompts.length,
        pid: plugin.process?.pid,
      };
    }

    return status;
  }

  startHealthChecks(): void {
    if (this.healthCheckTimer) return;

    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.healthCheckInterval);
  }

  private async performHealthChecks(): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      if (plugin.status === "running" && plugin.client) {
        try {
          // Simple ping to check if plugin is responsive
          await plugin.client.listTools();
        } catch (error) {
          console.warn(`Health check failed for plugin ${name}:`, error);
          this.handlePluginFailure(plugin);
        }
      }
    }
  }

  async shutdown(): Promise<void> {
    console.log("Shutting down all plugins...");

    if (this.healthCheckTimer) {
      clearTimeout(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    const shutdownPromises = Array.from(this.plugins.keys()).map((name) =>
      this.stopPlugin(name).catch((err) =>
        console.error(`Error stopping plugin ${name}:`, err)
      )
    );

    await Promise.all(shutdownPromises);
    this.plugins.clear();
  }
}
