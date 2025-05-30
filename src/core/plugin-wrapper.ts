#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "path";
import { pathToFileURL } from "url";

interface PluginInterface {
  name: string;
  version: string;
  description: string;
  dependencies: string[];
  initialize(context: any): Promise<void>;
  getTools(): Array<any>;
  getResources(): Array<any>;
  executeTool(name: string, args: any): Promise<any>;
  cleanup(): Promise<void>;
}

async function runPluginAsServer(): Promise<void> {
  const pluginPath = process.argv[2];
  const pluginName = process.env.PLUGIN_NAME || "unknown";

  if (!pluginPath) {
    console.error("Usage: plugin-wrapper.js <plugin-path>");
    process.exit(1);
  }

  try {
    // Load the plugin module
    const pluginModulePath = path.resolve(pluginPath);
    const pluginUrl = pathToFileURL(pluginModulePath).href;

    // Dynamic import the plugin
    const PluginClass = await import(pluginUrl);
    const PluginConstructor = PluginClass.default || PluginClass;

    // Instantiate the plugin
    const plugin: PluginInterface = new PluginConstructor();

    // Create MCP server using official SDK
    const server = new McpServer({
      name: plugin.name || pluginName,
      version: plugin.version || "1.0.0",
    });

    // Initialize the plugin
    const context = {
      logger: {
        info: (msg: string, ...args: any[]) =>
          console.log(`[${pluginName}] INFO:`, msg, ...args),
        warn: (msg: string, ...args: any[]) =>
          console.warn(`[${pluginName}] WARN:`, msg, ...args),
        error: (msg: string, ...args: any[]) =>
          console.error(`[${pluginName}] ERROR:`, msg, ...args),
        debug: (msg: string, ...args: any[]) =>
          console.debug(`[${pluginName}] DEBUG:`, msg, ...args),
      },
    };

    await plugin.initialize(context);

    // Register tools with the MCP server
    const tools = plugin.getTools();
    for (const tool of tools) {
      server.tool(tool.name, tool.inputSchema, async (args: any) => {
        try {
          const result = await plugin.executeTool(tool.name, args);

          // Ensure the result matches MCP format
          if (result && result.content) {
            return result;
          } else {
            // Convert legacy format to MCP format
            return {
              content: [
                {
                  type: "text",
                  text:
                    typeof result === "string"
                      ? result
                      : JSON.stringify(result, null, 2),
                },
              ],
            };
          }
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

    // Register resources with the MCP server
    try {
      const resources = plugin.getResources();
      for (const resource of resources) {
        server.resource(resource.name, resource.uri, async () => ({
          contents: [
            {
              uri: resource.uri,
              text: resource.description || "Resource content",
              mimeType: resource.mimeType || "text/plain",
            },
          ],
        }));
      }
    } catch (error) {
      // Plugin might not implement getResources
      console.warn(`Plugin ${pluginName} does not support resources:`, error);
    }

    // Set up graceful shutdown
    const shutdown = async () => {
      console.log(`Shutting down plugin ${pluginName}...`);
      try {
        await plugin.cleanup();
        await server.close();
        process.exit(0);
      } catch (error) {
        console.error(`Error during shutdown of plugin ${pluginName}:`, error);
        process.exit(1);
      }
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);

    // Connect server to stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.log(`Plugin ${pluginName} is running as MCP server`);
  } catch (error) {
    console.error(`Failed to start plugin ${pluginName}:`, error);
    process.exit(1);
  }
}

// Run the plugin server
if (require.main === module) {
  runPluginAsServer().catch((error) => {
    console.error("Plugin wrapper error:", error);
    process.exit(1);
  });
}

export { runPluginAsServer };
