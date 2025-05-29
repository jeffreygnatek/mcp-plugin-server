const http = require("http");

// Configuration
const SERVER_URL = "http://localhost:3000";
const ADMIN_TOKEN = "demo-admin-token";

// Helper function to make HTTP requests
function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SERVER_URL);
    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ADMIN_TOKEN}`,
        ...headers,
      },
    };

    const req = http.request(url, options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => (responseData += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on("error", reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function runDemo() {
  console.log("🚀 MCP Plugin Server Demo\n");

  try {
    // 1. Check server health
    console.log("1. Checking server health...");
    const health = await makeRequest("GET", "/health", null, {
      Authorization: "",
    });
    console.log(`   Status: ${health.status}`);
    console.log(`   Response: ${JSON.stringify(health.data, null, 2)}\n`);

    // 2. List plugins
    console.log("2. Listing plugins...");
    const plugins = await makeRequest("GET", "/api/plugins");
    console.log(`   Status: ${plugins.status}`);
    console.log(`   Plugins: ${JSON.stringify(plugins.data, null, 2)}\n`);

    // 3. Load hello-world plugin
    console.log("3. Loading hello-world plugin...");
    const loadResult = await makeRequest(
      "POST",
      "/api/plugins/hello-world/enable"
    );
    console.log(`   Status: ${loadResult.status}`);
    console.log(`   Response: ${JSON.stringify(loadResult.data, null, 2)}\n`);

    // 4. List available tools
    console.log("4. Listing available tools...");
    const tools = await makeRequest("GET", "/api/mcp/tools", null, {
      Authorization: "",
    });
    console.log(`   Status: ${tools.status}`);
    console.log(`   Tools: ${JSON.stringify(tools.data, null, 2)}\n`);

    // 5. Execute a tool
    console.log("5. Executing hello-world.say_hello tool...");
    const toolResult = await makeRequest(
      "POST",
      "/api/mcp/tools/execute",
      {
        toolName: "hello-world.say_hello",
        args: { name: "MCP Plugin Server" },
      },
      { Authorization: "" }
    );
    console.log(`   Status: ${toolResult.status}`);
    console.log(`   Result: ${JSON.stringify(toolResult.data, null, 2)}\n`);

    // 6. Execute echo tool
    console.log("6. Executing hello-world.echo tool...");
    const echoResult = await makeRequest(
      "POST",
      "/api/mcp/tools/execute",
      {
        toolName: "hello-world.echo",
        args: { message: "This is a test message!" },
      },
      { Authorization: "" }
    );
    console.log(`   Status: ${echoResult.status}`);
    console.log(`   Result: ${JSON.stringify(echoResult.data, null, 2)}\n`);

    console.log("✅ Demo completed successfully!");
  } catch (error) {
    console.error("❌ Demo failed:", error.message);
  }
}

// Run demo if this file is executed directly
if (require.main === module) {
  runDemo();
}

module.exports = { runDemo, makeRequest };
