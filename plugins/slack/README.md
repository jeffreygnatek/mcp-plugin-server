# Slack Plugin

A comprehensive TypeScript plugin for interacting with Slack workspaces through the MCP (Model Context Protocol) plugin system.

## Features

- List public channels with pagination
- Post messages to channels
- Reply to message threads
- Add emoji reactions to messages
- Get channel message history
- Get thread replies
- List workspace users
- Get detailed user profiles
- Full TypeScript implementation with proper type definitions
- Comprehensive error handling

## Setup

### 1. Slack App Configuration

You need to create a Slack app and obtain the necessary tokens:

1. **Create a Slack App**:

   - Go to [https://api.slack.com/apps](https://api.slack.com/apps)
   - Click "Create New App" → "From scratch"
   - Name your app and select your workspace

2. **Configure OAuth & Permissions**:

   - Go to "OAuth & Permissions" in your app settings
   - Add the following Bot Token Scopes:
     - `channels:read` - List public channels
     - `chat:write` - Post messages
     - `reactions:write` - Add reactions
     - `channels:history` - Read channel history
     - `users:read` - List users
     - `users:read.email` - Get user profiles

3. **Install the App**:

   - Click "Install to Workspace"
   - Copy the "Bot User OAuth Token" (starts with `xoxb-`)

4. **Get Team ID**:
   - Go to your workspace settings
   - Copy the Workspace ID (Team ID)

### 2. Environment Variables

Set the following environment variables with your Slack credentials:

```bash
export SLACK_BOT_TOKEN="xoxb-your-bot-token-here"
export SLACK_TEAM_ID="T1234567890"
```

## Usage

### Available Tools

#### 1. `list_channels`

List public channels in the workspace with pagination.

**Parameters:**

- `limit` (number, optional): Maximum number of channels to return (default 100, max 200)
- `cursor` (string, optional): Pagination cursor for next page of results

#### 2. `post_message`

Post a new message to a Slack channel.

**Parameters:**

- `channel_id` (string, required): The ID of the channel to post to
- `text` (string, required): The message text to post

#### 3. `reply_to_thread`

Reply to a specific message thread in Slack.

**Parameters:**

- `channel_id` (string, required): The ID of the channel containing the thread
- `thread_ts` (string, required): The timestamp of the parent message (format: '1234567890.123456')
- `text` (string, required): The reply text

#### 4. `add_reaction`

Add a reaction emoji to a message.

**Parameters:**

- `channel_id` (string, required): The ID of the channel containing the message
- `timestamp` (string, required): The timestamp of the message to react to
- `reaction` (string, required): The name of the emoji reaction (without ::)

#### 5. `get_channel_history`

Get recent messages from a channel.

**Parameters:**

- `channel_id` (string, required): The ID of the channel
- `limit` (number, optional): Number of messages to retrieve (default 10)

#### 6. `get_thread_replies`

Get all replies in a message thread.

**Parameters:**

- `channel_id` (string, required): The ID of the channel containing the thread
- `thread_ts` (string, required): The timestamp of the parent message

#### 7. `get_users`

Get a list of all users in the workspace.

**Parameters:**

- `cursor` (string, optional): Pagination cursor for next page of results
- `limit` (number, optional): Maximum number of users to return (default 100, max 200)

#### 8. `get_user_profile`

Get detailed profile information for a specific user.

**Parameters:**

- `user_id` (string, required): The ID of the user

## Tool Name Examples

When using the tools through the MCP plugin server, they will be prefixed with the plugin name:

- `slack.list_channels`
- `slack.post_message`
- `slack.reply_to_thread`
- `slack.add_reaction`
- `slack.get_channel_history`
- `slack.get_thread_replies`
- `slack.get_users`
- `slack.get_user_profile`

## Example Usage

```typescript
// List channels
await plugin.executeTool("list_channels", {
  limit: 50,
});

// Post a message
await plugin.executeTool("post_message", {
  channel_id: "C1234567890",
  text: "Hello from the MCP plugin server!",
});

// Reply to a thread
await plugin.executeTool("reply_to_thread", {
  channel_id: "C1234567890",
  thread_ts: "1234567890.123456",
  text: "This is a reply to the thread",
});

// Add a reaction
await plugin.executeTool("add_reaction", {
  channel_id: "C1234567890",
  timestamp: "1234567890.123456",
  reaction: "thumbsup",
});
```

## Finding Channel and User IDs

### Channel IDs

- In Slack, right-click on a channel name → "Copy link"
- The URL will contain the channel ID: `https://workspace.slack.com/archives/C1234567890`
- Or use the `list_channels` tool to get channel IDs programmatically

### User IDs

- In Slack, click on a user's profile → "More" → "Copy member ID"
- Or use the `get_users` tool to list all users with their IDs

### Message Timestamps

- Message timestamps are returned in the format `1234567890.123456`
- You can get these from `get_channel_history` or `get_thread_replies`

## Error Handling

The plugin handles various error scenarios:

- Invalid or missing authentication tokens
- Missing required parameters
- Network errors and API failures
- Slack API errors (rate limits, permissions, etc.)

All errors are returned in a structured format with detailed error messages.

## API Endpoints Used

This plugin interacts with the following Slack API endpoints:

- `GET /api/conversations.list` - List channels
- `POST /api/chat.postMessage` - Post messages and replies
- `POST /api/reactions.add` - Add reactions
- `GET /api/conversations.history` - Get channel history
- `GET /api/conversations.replies` - Get thread replies
- `GET /api/users.list` - List users
- `GET /api/users.profile.get` - Get user profiles

## Requirements

- Node.js runtime with fetch API support
- Valid Slack Bot User OAuth Token
- Slack Team ID
- Proper bot permissions configured in Slack app

## License

MIT License - see LICENSE file for details.
