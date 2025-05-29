class HelloWorldPlugin {
  constructor() {
    this.name = "hello-world";
    this.version = "1.0.0";
    this.description = "A simple hello world plugin for testing";
    this.dependencies = [];
  }

  async initialize(context) {
    this.context = context;
    context.logger.info("Hello World plugin initialized successfully");
  }

  getTools() {
    return [
      {
        name: "say_hello",
        description: "Returns a greeting message",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name to greet",
              default: "World",
            },
          },
          required: [],
        },
      },
      {
        name: "echo",
        description: "Echoes back the input message",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Message to echo back",
            },
          },
          required: ["message"],
        },
      },
    ];
  }

  getResources() {
    return [
      {
        uri: "hello://greetings",
        name: "Greetings",
        description: "Collection of greeting messages",
        mimeType: "application/json",
      },
    ];
  }

  async executeTool(name, args) {
    if (!this.context) {
      throw new Error("Plugin not properly initialized");
    }

    switch (name) {
      case "say_hello":
        const nameToGreet = args.name || "World";
        return {
          message: `Hello, ${nameToGreet}!`,
          timestamp: new Date().toISOString(),
          plugin: this.name,
        };

      case "echo":
        return {
          original: args.message,
          echo: args.message,
          length: args.message.length,
          timestamp: new Date().toISOString(),
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async cleanup() {
    if (this.context) {
      this.context.logger.info("Hello World plugin cleaned up");
      this.context = null;
    }
  }
}

module.exports = HelloWorldPlugin;
