# Sentry Plugin

A TypeScript plugin for fetching and analyzing Sentry issues through the MCP (Model Context Protocol) plugin system.

## Features

- Fetch detailed Sentry issue information
- Extract and format stacktraces from Sentry events
- Support for both Sentry issue IDs and full URLs
- Comprehensive error handling and validation
- TypeScript implementation with proper type definitions

## Setup

### 1. Authentication

You need a Sentry authentication token to use this plugin. You can obtain one from:

1. Go to your Sentry organization settings
2. Navigate to "Auth Tokens"
3. Create a new auth token with the necessary permissions (at minimum: `event:read`, `project:read`)

### 2. Environment Variables

Set one of the following environment variables with your Sentry auth token:

```bash
export SENTRY_AUTH_TOKEN="your_sentry_auth_token_here"
# OR
export MCP_SENTRY_AUTH_TOKEN="your_sentry_auth_token_here"
```

## Usage

### Tool: `get_sentry_issue`

Retrieve and analyze a Sentry issue by ID or URL.

**Parameters:**

- `issue_id_or_url` (string, required): Sentry issue ID (e.g., "1234567890") or full URL (e.g., "https://yourorg.sentry.io/issues/1234567890/")

**Example usage:**

```typescript
// Using issue ID
await plugin.executeTool("get_sentry_issue", {
  issue_id_or_url: "1234567890",
});

// Using full URL
await plugin.executeTool("get_sentry_issue", {
  issue_id_or_url: "https://yourorg.sentry.io/issues/1234567890/",
});
```

**Response format:**
The tool returns formatted text containing:

- Issue title and ID
- Status and level
- First seen and last seen timestamps
- Event count
- Detailed stacktrace from the latest event

## Error Handling

The plugin handles various error scenarios:

- Invalid or missing authentication tokens
- Invalid Sentry URLs or issue IDs
- Network errors and API failures
- Missing or malformed Sentry data

## API Endpoints Used

This plugin interacts with the following Sentry API endpoints:

- `GET /api/0/issues/{issue_id}/` - Fetch issue details
- `GET /api/0/issues/{issue_id}/hashes/` - Fetch issue events for stacktrace data

## Requirements

- Node.js runtime with fetch API support
- Valid Sentry authentication token
- Access to Sentry API endpoints

## License

MIT License - see LICENSE file for details.
