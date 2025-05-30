import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

class HelloWorldMCPServer {
  private server: McpServer;

  constructor() {
    this.server = new McpServer({
      name: "hello-world",
      version: "1.0.0",
    });

    this.setupTools();
    this.setupResources();
  }

  private setupTools(): void {
    // Say hello tool
    this.server.tool(
      "say_hello",
      {
        name: z.string().optional().default("World").describe("Name to greet"),
      },
      async ({ name }) => {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: `Hello, ${name}!`,
                  timestamp: new Date().toISOString(),
                  plugin: "hello-world",
                },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    // Echo tool
    this.server.tool(
      "echo",
      {
        message: z.string().describe("Message to echo back"),
      },
      async ({ message }) => {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  original: message,
                  echo: message,
                  length: message.length,
                  timestamp: new Date().toISOString(),
                },
                null,
                2
              ),
            },
          ],
        };
      }
    );
  }

  private setupResources(): void {
    this.server.resource("greetings", "hello://greetings", async () => ({
      contents: [
        {
          uri: "hello://greetings",
          text: JSON.stringify(
            {
              greetings: [
                "Hello, World!",
                "Hi there!",
                "Good morning!",
                "Welcome!",
                "Greetings!",
              ],
              languages: {
                en: "Hello",
                es: "Hola",
                fr: "Bonjour",
                de: "Hallo",
                it: "Ciao",
              },
            },
            null,
            2
          ),
          mimeType: "application/json",
        },
      ],
    }));
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log("Hello World MCP server is running");
  }

  async close(): Promise<void> {
    await this.server.close();
  }
}

// Start the server if this module is run directly
async function main(): Promise<void> {
  const server = new HelloWorldMCPServer();

  // Handle graceful shutdown
  const shutdown = async () => {
    try {
      await server.close();
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  await server.start();
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export default HelloWorldMCPServer;
