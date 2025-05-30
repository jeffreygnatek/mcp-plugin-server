// PostgreSQL database plugin implementation
const { Pool } = require("pg");

interface DatabaseConfig {
  connectionString: string;
}

interface TableInfo {
  table_name: string;
}

interface ColumnInfo {
  column_name: string;
  data_type: string;
}

class PostgresPlugin {
  private name: string;
  private version: string;
  private description: string;
  private dependencies: string[];
  private context: any;
  private pool: any | null;
  private databaseUrl: string;

  constructor() {
    this.name = "postgres";
    this.version = "1.0.0";
    this.description = "A plugin for interacting with PostgreSQL databases";
    this.dependencies = ["pg"];
    this.pool = null;
    this.databaseUrl = "";
  }

  async initialize(context: any): Promise<void> {
    this.context = context;

    // Get database URL from environment variables
    this.databaseUrl =
      process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

    if (!this.databaseUrl) {
      throw new Error(
        "Database URL not found. Please set DATABASE_URL or POSTGRES_URL environment variable."
      );
    }

    try {
      // Initialize connection pool
      this.pool = new Pool({
        connectionString: this.databaseUrl,
      });

      // Test the connection
      const client = await this.pool.connect();
      await client.query("SELECT 1");
      client.release();

      context.logger.info("PostgreSQL plugin initialized successfully");
    } catch (error) {
      throw new Error(
        `Failed to connect to PostgreSQL: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  getTools(): Array<any> {
    return [
      {
        name: "query",
        description:
          "Run a read-only SQL query against the PostgreSQL database",
        inputSchema: {
          type: "object",
          properties: {
            sql: {
              type: "string",
              description:
                "The SQL query to execute (read-only operations only)",
            },
          },
          required: ["sql"],
        },
      },
      {
        name: "list_tables",
        description: "List all tables in the public schema",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "describe_table",
        description: "Get the schema information for a specific table",
        inputSchema: {
          type: "object",
          properties: {
            table_name: {
              type: "string",
              description: "Name of the table to describe",
            },
          },
          required: ["table_name"],
        },
      },
      {
        name: "get_table_sample",
        description:
          "Get a sample of rows from a specific table (limited to 10 rows)",
        inputSchema: {
          type: "object",
          properties: {
            table_name: {
              type: "string",
              description: "Name of the table to sample",
            },
            limit: {
              type: "integer",
              description: "Number of rows to return (default: 10, max: 100)",
              minimum: 1,
              maximum: 100,
              default: 10,
            },
          },
          required: ["table_name"],
        },
      },
    ];
  }

  getResources(): Array<any> {
    return [
      {
        uri: "postgres://database/schema",
        name: "Database Schema",
        description: "Complete database schema information",
        mimeType: "application/json",
      },
    ];
  }

  private async executeReadOnlyQuery(sql: string): Promise<any[]> {
    if (!this.pool) {
      throw new Error("Database not initialized");
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN TRANSACTION READ ONLY");
      const result = await client.query(sql);
      return result.rows;
    } catch (error) {
      throw error;
    } finally {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        this.context?.logger?.warn(
          "Could not roll back transaction:",
          rollbackError
        );
      }
      client.release();
    }
  }

  private async listTables(): Promise<TableInfo[]> {
    const sql =
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name";
    return await this.executeReadOnlyQuery(sql);
  }

  private async describeTable(tableName: string): Promise<ColumnInfo[]> {
    const sql = `
      SELECT 
        column_name, 
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns 
      WHERE table_name = $1 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `;

    if (!this.pool) {
      throw new Error("Database not initialized");
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, [tableName]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  private async getTableSample(
    tableName: string,
    limit: number = 10
  ): Promise<any[]> {
    // Sanitize table name to prevent SQL injection
    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, "");
    if (sanitizedTableName !== tableName) {
      throw new Error("Invalid table name");
    }

    const sql = `SELECT * FROM "${sanitizedTableName}" LIMIT $1`;

    if (!this.pool) {
      throw new Error("Database not initialized");
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, [Math.min(limit, 100)]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async executeTool(name: string, args: any): Promise<any> {
    if (!this.context || !this.pool) {
      throw new Error("Plugin not properly initialized");
    }

    try {
      switch (name) {
        case "query": {
          const { sql } = args;
          if (!sql || typeof sql !== "string") {
            throw new Error("SQL query is required and must be a string");
          }

          const rows = await this.executeReadOnlyQuery(sql);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(rows, null, 2),
              },
            ],
          };
        }

        case "list_tables": {
          const tables = await this.listTables();
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    tables: tables,
                    count: tables.length,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case "describe_table": {
          const { table_name } = args;
          if (!table_name || typeof table_name !== "string") {
            throw new Error("table_name is required and must be a string");
          }

          const schema = await this.describeTable(table_name);
          if (schema.length === 0) {
            throw new Error(`Table '${table_name}' not found`);
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    table_name: table_name,
                    columns: schema,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case "get_table_sample": {
          const { table_name, limit = 10 } = args;
          if (!table_name || typeof table_name !== "string") {
            throw new Error("table_name is required and must be a string");
          }

          const sample = await this.getTableSample(table_name, limit);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    table_name: table_name,
                    sample_size: sample.length,
                    rows: sample,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
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
    if (this.pool) {
      try {
        await this.pool.end();
        this.context?.logger?.info("PostgreSQL connection pool closed");
      } catch (error) {
        this.context?.logger?.error("Error closing PostgreSQL pool:", error);
      }
      this.pool = null;
    }

    if (this.context) {
      this.context.logger.info("PostgreSQL plugin cleaned up");
      this.context = null;
    }
  }
}

module.exports = PostgresPlugin;
