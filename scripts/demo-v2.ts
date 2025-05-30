#!/usr/bin/env tsx
import { MCPPluginServer } from "../src/server-v2.js";

async function demoV2Architecture(): Promise<void> {
  console.log("🎮 Demonstrating Process-Based Plugin Architecture");
  console.log("=".repeat(60));

  // Create server instance
  const server = new MCPPluginServer({
    name: "Demo MCP Plugin Server",
    version: "2.0.0-demo",
    pluginsDir: "plugins",
    processes: {
      maxRestarts: 3,
      restartDelay: 1000,
      healthCheckInterval: 10000,
    },
  });

  // Set up graceful shutdown
  const shutdown = async () => {
    console.log("\n🛑 Shutting down demo...");
    try {
      await server.shutdown();
      process.exit(0);
    } catch (error) {
      console.error("❌ Error during shutdown:", error);
      process.exit(1);
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  try {
    console.log("🚀 Starting server...\n");
    await server.start();

    // Keep the demo running
    console.log("\n✅ Demo server is running!");
    console.log("📋 Features demonstrated:");
    console.log("   • Plugin process isolation");
    console.log("   • Official MCP SDK integration");
    console.log("   • Automatic tool discovery and namespacing");
    console.log("   • Health monitoring and auto-restart");
    console.log("   • Graceful process management");
    console.log("\n🔧 Available tools include:");
    console.log("   • hello-world.say_hello");
    console.log("   • hello-world.echo");
    console.log("   • postgres.query (if configured)");
    console.log("   • slack.post_message (if configured)");
    console.log("   • plugins.status (meta tool)");
    console.log("   • plugins.restart (meta tool)");
    console.log("\n⏸️  Press Ctrl+C to stop the demo");

    // Keep running
    await new Promise(() => {});
  } catch (error) {
    console.error("❌ Demo failed:", error);
    process.exit(1);
  }
}

// Run the demo
demoV2Architecture().catch((error) => {
  console.error("Fatal demo error:", error);
  process.exit(1);
});
