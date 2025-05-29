import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import * as dotenv from "dotenv";
import { WebSocketServer } from "ws";
import { createServer } from "http";

import { FilePluginRegistry } from "./core/registry";
import { DefaultPluginManager } from "./core/plugin-manager";
import { FileSecureStorage } from "./core/auth/secure-storage";

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;
const MASTER_KEY =
  process.env.MASTER_KEY || FileSecureStorage.generateMasterKey();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
    ],
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api/", limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Initialize core components
const secureStorage = new FileSecureStorage(MASTER_KEY);
const pluginRegistry = new FilePluginRegistry();
const pluginManager = new DefaultPluginManager(pluginRegistry, secureStorage);

// Basic authentication middleware (for admin endpoints)
const basicAuth = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: "Authorization required" });
    return;
  }

  const token = authHeader.split(" ")[1];
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken || token !== adminToken) {
    res.status(401).json({ error: "Invalid authorization token" });
    return;
  }

  next();
};

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Plugin management endpoints
app.get("/api/plugins", basicAuth, async (req, res) => {
  try {
    const plugins = pluginRegistry.listPlugins();
    res.json({ plugins });
  } catch (error) {
    res.status(500).json({
      error: "Failed to list plugins",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/plugins/:id/enable", basicAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: "Plugin ID is required" });
      return;
    }
    await pluginRegistry.enablePlugin(id);
    await pluginManager.initializePlugin(id);
    res.json({ message: `Plugin ${id} enabled successfully` });
  } catch (error) {
    res.status(500).json({
      error: "Failed to enable plugin",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/plugins/:id/disable", basicAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: "Plugin ID is required" });
      return;
    }
    await pluginManager.shutdownPlugin(id);
    await pluginRegistry.disablePlugin(id);
    res.json({ message: `Plugin ${id} disabled successfully` });
  } catch (error) {
    res.status(500).json({
      error: "Failed to disable plugin",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.put("/api/plugins/:id/config", basicAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: "Plugin ID is required" });
      return;
    }
    const config = req.body;
    await pluginRegistry.updatePluginConfig(id, config);
    res.json({ message: `Plugin ${id} configuration updated successfully` });
  } catch (error) {
    res.status(500).json({
      error: "Failed to update plugin configuration",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.delete("/api/plugins/:id", basicAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: "Plugin ID is required" });
      return;
    }
    await pluginManager.shutdownPlugin(id);
    await pluginRegistry.unloadPlugin(id);
    res.json({ message: `Plugin ${id} removed successfully` });
  } catch (error) {
    res.status(500).json({
      error: "Failed to remove plugin",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Credential management endpoints
app.post("/api/auth/credentials", basicAuth, async (req, res) => {
  try {
    const { pluginId, credentialId, value } = req.body;

    if (!pluginId || !credentialId || !value) {
      res
        .status(400)
        .json({ error: "pluginId, credentialId, and value are required" });
      return;
    }

    await secureStorage.storeCredential(pluginId, credentialId, value);
    res.json({ message: "Credential stored successfully" });
  } catch (error) {
    res.status(500).json({
      error: "Failed to store credential",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/auth/credentials/:pluginId", basicAuth, async (req, res) => {
  try {
    const { pluginId } = req.params;
    if (!pluginId) {
      res.status(400).json({ error: "Plugin ID is required" });
      return;
    }
    const credentials = await secureStorage.listCredentials(pluginId);
    res.json({ credentials });
  } catch (error) {
    res.status(500).json({
      error: "Failed to list credentials",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.delete(
  "/api/auth/credentials/:pluginId/:credentialId",
  basicAuth,
  async (req, res) => {
    try {
      const { pluginId, credentialId } = req.params;
      if (!pluginId || !credentialId) {
        res
          .status(400)
          .json({ error: "Plugin ID and credential ID are required" });
        return;
      }
      await secureStorage.deleteCredential(pluginId, credentialId);
      res.json({ message: "Credential deleted successfully" });
    } catch (error) {
      res.status(500).json({
        error: "Failed to delete credential",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

// MCP protocol endpoints
app.get("/api/mcp/tools", (req, res) => {
  try {
    const tools = pluginManager.getAvailableTools();
    res.json({ tools });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get tools",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/mcp/resources", (req, res) => {
  try {
    const resources = pluginManager.getAvailableResources();
    res.json({ resources });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get resources",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/mcp/tools/execute", async (req, res) => {
  try {
    const { toolName, args } = req.body;

    if (!toolName) {
      res.status(400).json({ error: "toolName is required" });
      return;
    }

    // Parse plugin name and tool name from the full tool name
    const [pluginName, actualToolName] = toolName.split(".");
    if (!pluginName || !actualToolName) {
      res.status(400).json({
        error: "Invalid tool name format. Expected: pluginName.toolName",
      });
      return;
    }

    const result = await pluginManager.executeTool(
      pluginName,
      actualToolName,
      args || {}
    );
    res.json({ result });
  } catch (error) {
    res.status(500).json({
      error: "Failed to execute tool",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// WebSocket server for MCP protocol
const wss = new WebSocketServer({ server, path: "/mcp" });

wss.on("connection", (ws) => {
  console.log("New MCP WebSocket connection established");

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString());

      // Basic MCP message handling
      switch (message.method) {
        case "tools/list":
          const tools = pluginManager.getAvailableTools();
          ws.send(
            JSON.stringify({
              jsonrpc: "2.0",
              id: message.id,
              result: { tools },
            })
          );
          break;

        case "tools/call":
          const { name, arguments: args } = message.params;
          const [pluginName, toolName] = name.split(".");
          const result = await pluginManager.executeTool(
            pluginName,
            toolName,
            args
          );
          ws.send(
            JSON.stringify({
              jsonrpc: "2.0",
              id: message.id,
              result: {
                content: [
                  { type: "text", text: JSON.stringify(result, null, 2) },
                ],
              },
            })
          );
          break;

        case "resources/list":
          const resources = pluginManager.getAvailableResources();
          ws.send(
            JSON.stringify({
              jsonrpc: "2.0",
              id: message.id,
              result: { resources },
            })
          );
          break;

        default:
          ws.send(
            JSON.stringify({
              jsonrpc: "2.0",
              id: message.id,
              error: {
                code: -32601,
                message: `Method ${message.method} not found`,
              },
            })
          );
      }
    } catch (error) {
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32603,
            message: "Internal error",
            data: error instanceof Error ? error.message : String(error),
          },
        })
      );
    }
  });

  ws.on("close", () => {
    console.log("MCP WebSocket connection closed");
  });

  ws.on("error", (error) => {
    console.error("MCP WebSocket error:", error);
  });
});

// Error handling middleware
app.use(
  (
    error: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Unhandled error:", error);
    res.status(500).json({
      error: "Internal server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Graceful shutdown
const gracefulShutdown = async (): Promise<void> => {
  console.log("Shutting down gracefully...");

  try {
    await pluginManager.shutdownAllPlugins();
    console.log("All plugins shut down successfully");
  } catch (error) {
    console.error("Error shutting down plugins:", error);
  }

  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Start server
async function startServer(): Promise<void> {
  try {
    // Initialize plugins on startup
    const discoveredPlugins = await pluginRegistry.discoverPlugins();
    console.log(
      `Discovered ${discoveredPlugins.length} plugins:`,
      discoveredPlugins
    );

    // For now, we don't auto-load plugins. They need to be explicitly loaded via API

    server.listen(PORT, () => {
      console.log(`MCP Plugin Server running on port ${PORT}`);
      console.log(`WebSocket MCP endpoint: ws://localhost:${PORT}/mcp`);
      console.log(`Health check: http://localhost:${PORT}/health`);

      if (!process.env.MASTER_KEY) {
        console.warn(
          "WARNING: Using auto-generated master key. Set MASTER_KEY environment variable for production."
        );
        console.warn("Generated master key:", MASTER_KEY);
      }

      if (!process.env.ADMIN_TOKEN) {
        console.warn(
          "WARNING: No ADMIN_TOKEN set. Admin endpoints will be inaccessible."
        );
      }
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
