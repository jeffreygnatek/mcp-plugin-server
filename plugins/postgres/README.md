# PostgreSQL Plugin

A comprehensive TypeScript plugin for interacting with PostgreSQL databases through the MCP (Model Context Protocol) plugin system. This plugin provides safe, read-only access to PostgreSQL databases with tools for querying, schema inspection, and data exploration.

## Features

- **Read-only queries** - Execute SQL queries safely in read-only transactions
- **Schema exploration** - List tables and inspect table structures
- **Data sampling** - Get sample data from tables for analysis
- **Connection pooling** - Efficient database connection management
- **SQL injection protection** - Parameterized queries and input sanitization
- **Comprehensive error handling** - Detailed error messages and transaction rollback
- **TypeScript implementation** - Full type safety and interfaces

## Setup

### 1. Dependencies

This plugin requires the `pg` (node-postgres) package. Make sure to install it in your project:

```bash
npm install pg
npm install @types/pg  # For TypeScript support
```

### 2. Database Configuration

You need a PostgreSQL database connection URL. Set one of these environment variables:

```bash
export DATABASE_URL="postgresql://username:password@hostname:5432/database_name"
# OR
export POSTGRES_URL="postgresql://username:password@hostname:5432/database_name"
```

### Connection URL Format

```
postgresql://[user[:password]@][netloc][:port][/dbname][?param1=value1&...]
```

Examples:

```bash
# Local database
export DATABASE_URL="postgresql://postgres:password@localhost:5432/mydb"

# Remote database with SSL
export DATABASE_URL="postgresql://user:pass@host.com:5432/db?sslmode=require"

# Cloud database (e.g., Heroku, AWS RDS)
export DATABASE_URL="postgresql://user:pass@host.amazonaws.com:5432/db"
```

## Usage

### Available Tools

#### 1. `query`

Execute read-only SQL queries against the database.

**Parameters:**

- `sql` (string, required): The SQL query to execute (read-only operations only)

**Safety Features:**

- Runs in `READ ONLY` transaction mode
- Automatic transaction rollback
- No data modification possible

#### 2. `list_tables`

List all tables in the public schema.

**Parameters:** None required

**Returns:** Array of table names with count

#### 3. `describe_table`

Get detailed schema information for a specific table.

**Parameters:**

- `table_name` (string, required): Name of the table to describe

**Returns:** Complete column information including:

- Column names and data types
- Nullable constraints
- Default values
- Character lengths
- Numeric precision and scale

#### 4. `get_table_sample`

Get a sample of rows from a specific table.

**Parameters:**

- `table_name` (string, required): Name of the table to sample
- `limit` (integer, optional): Number of rows to return (default: 10, max: 100)

**Safety Features:**

- Limited to 100 rows maximum
- Table name sanitization to prevent SQL injection
- Safe parameterized queries

## Tool Name Examples

When using through the MCP plugin server, tools are prefixed with the plugin name:

- `postgres.query`
- `postgres.list_tables`
- `postgres.describe_table`
- `postgres.get_table_sample`

## Example Usage

### Basic SQL Query

```typescript
// Simple SELECT query
await plugin.executeTool("query", {
  sql: "SELECT * FROM users WHERE active = true LIMIT 10",
});

// Aggregate query
await plugin.executeTool("query", {
  sql: "SELECT COUNT(*) as total_users, AVG(age) as avg_age FROM users",
});

// JOIN query
await plugin.executeTool("query", {
  sql: `
    SELECT u.name, p.title, p.created_at 
    FROM users u 
    JOIN posts p ON u.id = p.user_id 
    WHERE p.published = true
    ORDER BY p.created_at DESC
    LIMIT 20
  `,
});
```

### Schema Exploration

```typescript
// List all tables
await plugin.executeTool("list_tables", {});

// Get table structure
await plugin.executeTool("describe_table", {
  table_name: "users",
});

// Sample data from a table
await plugin.executeTool("get_table_sample", {
  table_name: "products",
  limit: 25,
});
```

### Data Analysis Queries

```typescript
// Statistical analysis
await plugin.executeTool("query", {
  sql: `
    SELECT 
      DATE_TRUNC('month', created_at) as month,
      COUNT(*) as new_users,
      AVG(age) as avg_age
    FROM users 
    GROUP BY month 
    ORDER BY month DESC
  `,
});

// Complex reporting
await plugin.executeTool("query", {
  sql: `
    WITH monthly_stats AS (
      SELECT 
        DATE_TRUNC('month', order_date) as month,
        SUM(total_amount) as revenue,
        COUNT(*) as order_count
      FROM orders 
      WHERE order_date >= NOW() - INTERVAL '12 months'
      GROUP BY month
    )
    SELECT 
      month,
      revenue,
      order_count,
      revenue / order_count as avg_order_value
    FROM monthly_stats
    ORDER BY month
  `,
});
```

## Security Features

### Read-Only Access

- All queries run in `BEGIN TRANSACTION READ ONLY` mode
- No INSERT, UPDATE, DELETE, or DDL operations possible
- Automatic transaction rollback after each query

### SQL Injection Protection

- Table names are sanitized using regex validation
- Parameterized queries where applicable
- Input validation for all parameters

### Connection Security

- Connection pooling for efficient resource usage
- Proper connection cleanup and release
- Error handling with connection recovery

## Error Handling

The plugin provides comprehensive error handling:

### Database Connection Errors

```json
{
  "error": "Failed to connect to PostgreSQL: connection refused",
  "status": "failed"
}
```

### SQL Syntax Errors

```json
{
  "error": "syntax error at or near \"SELEC\"",
  "status": "failed"
}
```

### Table Not Found

```json
{
  "error": "Table 'nonexistent_table' not found",
  "status": "failed"
}
```

### Invalid Parameters

```json
{
  "error": "table_name is required and must be a string",
  "status": "failed"
}
```

## Output Format

### Query Results

```json
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "created_at": "2024-01-15T10:30:00Z"
  },
  {
    "id": 2,
    "name": "Jane Smith",
    "email": "jane@example.com",
    "created_at": "2024-01-16T14:20:00Z"
  }
]
```

### Table List

```json
{
  "tables": [
    { "table_name": "users" },
    { "table_name": "posts" },
    { "table_name": "categories" }
  ],
  "count": 3
}
```

### Table Schema

```json
{
  "table_name": "users",
  "columns": [
    {
      "column_name": "id",
      "data_type": "integer",
      "is_nullable": "NO",
      "column_default": "nextval('users_id_seq'::regclass)",
      "character_maximum_length": null,
      "numeric_precision": 32,
      "numeric_scale": 0
    },
    {
      "column_name": "email",
      "data_type": "character varying",
      "is_nullable": "NO",
      "column_default": null,
      "character_maximum_length": 255,
      "numeric_precision": null,
      "numeric_scale": null
    }
  ]
}
```

## Best Practices

### Query Performance

1. **Use LIMIT** - Always limit large result sets
2. **Index awareness** - Structure queries to use existing indexes
3. **Avoid SELECT \*** - Select only needed columns for large tables
4. **Use EXPLAIN** - Analyze query performance when needed

### Data Exploration

1. **Start with table list** - Use `list_tables` to discover available data
2. **Examine schema** - Use `describe_table` before writing queries
3. **Sample first** - Use `get_table_sample` to understand data structure
4. **Build incrementally** - Start with simple queries and add complexity

### Security

1. **Read-only mindset** - Remember all operations are read-only
2. **Validate inputs** - Always validate table names and parameters
3. **Limit results** - Use appropriate LIMIT clauses
4. **Monitor connections** - Be aware of connection pool limits

## Troubleshooting

### Connection Issues

- Verify DATABASE_URL is correctly formatted
- Check network connectivity to database host
- Ensure PostgreSQL server is running and accepting connections
- Verify authentication credentials

### Permission Issues

- Ensure database user has SELECT permissions on target tables
- Check if tables exist in the 'public' schema
- Verify user can connect to the specified database

### Query Issues

- Test queries in a PostgreSQL client first
- Check for syntax errors in SQL
- Ensure referenced tables and columns exist
- Verify data types in WHERE clauses

## Dependencies

- **pg** - PostgreSQL client for Node.js
- **@types/pg** - TypeScript type definitions (development)

## Integration

This plugin integrates seamlessly with your MCP plugin server and can be used alongside other plugins for comprehensive data analysis workflows. The read-only nature makes it safe for AI agents to explore and analyze data without risk of modification.
