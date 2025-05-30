import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ProcessManager } from "./core/process-manager.js";
import { z } from "zod";

interface ServerConfig {
  name: string;
  version: string;
  pluginsDir: string;
  processes: {
    maxRestarts: number;
    restartDelay: number;
    healthCheckInterval: number;
  };
}

class MCPPluginServer {
  private server: McpServer;
  private processManager: ProcessManager;
  private config: ServerConfig;

  constructor(config: Partial<ServerConfig> = {}) {
    this.config = {
      name: "MCP Plugin Server",
      version: "2.0.0",
      pluginsDir: "plugins",
      processes: {
        maxRestarts: 3,
        restartDelay: 1000,
        healthCheckInterval: 30000,
      },
      ...config,
    };

    this.server = new McpServer({
      name: this.config.name,
      version: this.config.version,
    });

    this.processManager = new ProcessManager({
      maxRestarts: this.config.processes.maxRestarts,
      restartDelay: this.config.processes.restartDelay,
      healthCheckInterval: this.config.processes.healthCheckInterval,
    });

    this.setupServerTools();
    this.setupEventHandlers();
  }

  private setupServerTools(): void {
    // Meta tool to get plugin status
    this.server.tool("plugins.status", {}, async () => {
      const status = this.processManager.getPluginStatus();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    });

    // Meta tool to restart a plugin
    this.server.tool(
      "plugins.restart",
      {
        plugin_name: z.string().describe("Name of the plugin to restart"),
      },
      async ({ plugin_name }) => {
        try {
          await this.processManager.restartPlugin(plugin_name);
          return {
            content: [
              {
                type: "text",
                text: `Plugin ${plugin_name} restarted successfully`,
              },
            ],
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    error: `Failed to restart plugin ${plugin_name}: ${errorMessage}`,
                    status: "failed",
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  private setupEventHandlers(): void {
    this.processManager.on("pluginStarted", (pluginName, plugin) => {
      console.log(
        `✅ Plugin ${pluginName} started with ${plugin.tools.length} tools`
      );
      this.updateDynamicTools();
    });

    this.processManager.on("pluginStopped", (pluginName) => {
      console.log(`🛑 Plugin ${pluginName} stopped`);
      this.updateDynamicTools();
    });

    this.processManager.on("pluginFailed", (pluginName, error) => {
      console.error(`❌ Plugin ${pluginName} failed:`, error);
      this.updateDynamicTools();
    });
  }

  private updateDynamicTools(): void {
    // Clear existing dynamic tools
    this.clearDynamicTools();

    // Add tools from all running plugins
    const allTools = this.processManager.getAllTools();

    for (const tool of allTools) {
      const parts = tool.name.split(".", 2);
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        console.warn(`Invalid tool name format: ${tool.name}`);
        continue;
      }

      const pluginName = parts[0];
      const toolName = parts[1];

      this.server.tool(tool.name, tool.inputSchema, async (args: any) => {
        try {
          return await this.processManager.executeToolInPlugin(
            pluginName,
            toolName,
            args
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    error: errorMessage,
                    plugin: pluginName,
                    tool: toolName,
                    status: "failed",
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }
      });
    }

    console.log(
      `🔄 Updated server with ${allTools.length} tools from ${
        Object.keys(this.processManager.getPluginStatus()).length
      } plugins`
    );
  }

  private clearDynamicTools(): void {
    // This would need to be implemented in the MCP SDK
    // For now, we'll track tools manually
    console.log("🧹 Clearing dynamic tools (not yet implemented in SDK)");
  }

  async start(): Promise<void> {
    try {
      console.log(`🚀 Starting ${this.config.name} v${this.config.version}`);

      // Discover and start plugins
      console.log(`🔍 Discovering plugins in ${this.config.pluginsDir}...`);
      const pluginConfigs = await this.processManager.discoverPlugins(
        this.config.pluginsDir
      );

      console.log(`📦 Found ${pluginConfigs.length} plugins`);

      // Start all plugins
      const startPromises = pluginConfigs.map(async (config) => {
        try {
          await this.processManager.startPlugin(config);
        } catch (error) {
          console.error(`Failed to start plugin ${config.name}:`, error);
        }
      });

      await Promise.allSettled(startPromises);

      // Start health checks
      this.processManager.startHealthChecks();

      // Update tools after all plugins are started
      this.updateDynamicTools();

      // Connect to transport
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      console.log(
        `✅ ${this.config.name} is running and ready for connections`
      );
    } catch (error) {
      console.error("❌ Failed to start server:", error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    console.log("🛑 Shutting down server...");

    try {
      await this.processManager.shutdown();
      await this.server.close();
      console.log("✅ Server shutdown complete");
    } catch (error) {
      console.error("❌ Error during shutdown:", error);
      throw error;
    }
  }
}

// Create and start the server
async function main(): Promise<void> {
  const server = new MCPPluginServer();

  // Handle graceful shutdown
  const shutdown = async () => {
    try {
      await server.shutdown();
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // Start the server
  await server.start();
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { MCPPluginServer };
