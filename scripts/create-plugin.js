#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: npm run plugin:create <plugin-name> [dependencies...]");
  console.error("Example: npm run plugin:create my-plugin axios @types/axios");
  process.exit(1);
}

const pluginName = args[0];
const dependencies = args.slice(1);

// Validate plugin name
if (!/^[a-z][a-z0-9-]*$/.test(pluginName)) {
  console.error(
    "Plugin name must be lowercase, start with a letter, and contain only letters, numbers, and hyphens"
  );
  process.exit(1);
}

const pluginDir = path.join("plugins", pluginName);

// Check if plugin already exists
if (fs.existsSync(pluginDir)) {
  console.error(`Plugin '${pluginName}' already exists!`);
  process.exit(1);
}

// Create plugin directory
fs.mkdirSync(pluginDir, { recursive: true });

// Create package.json
const packageJson = {
  name: `@mcp-plugins/${pluginName}`,
  version: "1.0.0",
  description: `${pluginName} plugin for MCP server`,
  main: "index.ts",
  private: true,
  scripts: {
    build: "tsc",
    test: "jest",
    lint: "eslint *.ts",
  },
  keywords: ["mcp", pluginName, "plugin"],
  author: "Jeffrey Gnatek",
  license: "MIT",
  dependencies: {},
  devDependencies: {
    "@types/node": "^20.10.0",
  },
  peerDependencies: {
    typescript: "^5.0.0",
  },
  engines: {
    node: ">=18.0.0",
  },
};

// Add dependencies if specified
if (dependencies.length > 0) {
  dependencies.forEach((dep) => {
    // Simple heuristic: if it starts with @types/ it's a dev dependency
    if (dep.startsWith("@types/")) {
      packageJson.devDependencies[dep] = "^1.0.0";
    } else {
      packageJson.dependencies[dep] = "^1.0.0";
    }
  });
}

fs.writeFileSync(
  path.join(pluginDir, "package.json"),
  JSON.stringify(packageJson, null, 2)
);

// Create plugin.json
const pluginConfig = {
  name: pluginName,
  version: "1.0.0",
  description: `${pluginName} plugin for MCP server`,
  main: "index.ts",
  dependencies: Object.keys(packageJson.dependencies),
};

fs.writeFileSync(
  path.join(pluginDir, "plugin.json"),
  JSON.stringify(pluginConfig, null, 2)
);

// Create TypeScript plugin template
const className =
  pluginName
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("") + "Plugin";

const pluginTemplate = `// ${pluginName} plugin implementation

interface ${className}Context {
  logger: any;
}

class ${className} {
  private name: string;
  private version: string;
  private description: string;
  private dependencies: string[];
  private context: ${className}Context | null;

  constructor() {
    this.name = "${pluginName}";
    this.version = "1.0.0";
    this.description = "${pluginName} plugin for MCP server";
    this.dependencies = ${JSON.stringify(
      Object.keys(packageJson.dependencies)
    )};
    this.context = null;
  }

  async initialize(context: ${className}Context): Promise<void> {
    this.context = context;
    context.logger.info("${className} initialized successfully");
  }

  getTools(): Array<any> {
    return [
      {
        name: "example_tool",
        description: "An example tool for ${pluginName}",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Message to process",
            },
          },
          required: ["message"],
        },
      },
    ];
  }

  getResources(): Array<any> {
    return [
      {
        uri: "${pluginName}://example",
        name: "Example Resource",
        description: "Example resource for ${pluginName}",
        mimeType: "application/json",
      },
    ];
  }

  async executeTool(name: string, args: any): Promise<any> {
    if (!this.context) {
      throw new Error("Plugin not properly initialized");
    }

    try {
      switch (name) {
        case "example_tool":
          const { message } = args;
          if (!message || typeof message !== "string") {
            throw new Error("message is required and must be a string");
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    processed_message: message,
                    plugin: this.name,
                    timestamp: new Date().toISOString(),
                  },
                  null,
                  2
                ),
              },
            ],
          };

        default:
          throw new Error(\`Unknown tool: \${name}\`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: error instanceof Error ? error.message : String(error),
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

  async cleanup(): Promise<void> {
    if (this.context) {
      this.context.logger.info("${className} cleaned up");
      this.context = null;
    }
  }
}

module.exports = ${className};
`;

fs.writeFileSync(path.join(pluginDir, "index.ts"), pluginTemplate);

// Create README.md
const readmeTemplate = `# ${pluginName} Plugin

${pluginName} plugin for the MCP plugin server.

## Description

${pluginName} plugin for MCP server

## Setup

### Dependencies

This plugin requires the following dependencies:
${
  dependencies.length > 0
    ? dependencies.map((dep) => `- \`${dep}\``).join("\n")
    : "- No external dependencies"
}

### Configuration

Add any required environment variables or configuration here.

## Usage

### Available Tools

#### \`example_tool\`

Description of the example tool.

**Parameters:**
- \`message\` (string, required): Message to process

## Examples

\`\`\`typescript
// Example usage
await plugin.executeTool("example_tool", {
  message: "Hello, world!",
});
\`\`\`

## Tool Names

When using through the MCP plugin server, tools are prefixed with the plugin name:
- \`${pluginName}.example_tool\`

## Development

\`\`\`bash
# Install dependencies
npm install

# Build the plugin
npm run build

# Run tests
npm test

# Lint code
npm run lint
\`\`\`
`;

fs.writeFileSync(path.join(pluginDir, "README.md"), readmeTemplate);

console.log(`✅ Created plugin '${pluginName}' in ${pluginDir}`);
console.log("\nNext steps:");
console.log("1. Install dependencies: npm install");
console.log(
  `2. Edit ${path.join(pluginDir, "index.ts")} to implement your plugin`
);
console.log(
  `3. Update ${path.join(pluginDir, "README.md")} with documentation`
);
console.log("4. Test your plugin with: npm run plugins:test");

// Auto-install dependencies
if (dependencies.length > 0) {
  console.log("\nInstalling plugin dependencies...");
  exec("npm install", { cwd: pluginDir }, (error, stdout, stderr) => {
    if (error) {
      console.error("Error installing dependencies:", error);
    } else {
      console.log("✅ Dependencies installed successfully");
    }
  });
}
