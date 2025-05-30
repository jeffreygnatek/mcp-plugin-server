// Type definitions for tool arguments
interface ListChannelsArgs {
  limit?: number;
  cursor?: string;
}

interface PostMessageArgs {
  channel_id: string;
  text: string;
}

interface ReplyToThreadArgs {
  channel_id: string;
  thread_ts: string;
  text: string;
}

interface AddReactionArgs {
  channel_id: string;
  timestamp: string;
  reaction: string;
}

interface GetChannelHistoryArgs {
  channel_id: string;
  limit?: number;
}

interface GetThreadRepliesArgs {
  channel_id: string;
  thread_ts: string;
}

interface GetUsersArgs {
  cursor?: string;
  limit?: number;
}

interface GetUserProfileArgs {
  user_id: string;
}

class SlackClient {
  private botHeaders: { Authorization: string; "Content-Type": string };
  private teamId: string;

  constructor(botToken: string, teamId: string) {
    this.botHeaders = {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json",
    };
    this.teamId = teamId;
  }

  async getChannels(limit: number = 100, cursor?: string): Promise<any> {
    const params = new URLSearchParams({
      types: "public_channel",
      exclude_archived: "true",
      limit: Math.min(limit, 200).toString(),
      team_id: this.teamId,
    });

    if (cursor) {
      params.append("cursor", cursor);
    }

    const response = await fetch(
      `https://slack.com/api/conversations.list?${params}`,
      { headers: this.botHeaders }
    );

    return response.json();
  }

  async postMessage(channel_id: string, text: string): Promise<any> {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: this.botHeaders,
      body: JSON.stringify({
        channel: channel_id,
        text: text,
      }),
    });

    return response.json();
  }

  async postReply(
    channel_id: string,
    thread_ts: string,
    text: string
  ): Promise<any> {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: this.botHeaders,
      body: JSON.stringify({
        channel: channel_id,
        thread_ts: thread_ts,
        text: text,
      }),
    });

    return response.json();
  }

  async addReaction(
    channel_id: string,
    timestamp: string,
    reaction: string
  ): Promise<any> {
    const response = await fetch("https://slack.com/api/reactions.add", {
      method: "POST",
      headers: this.botHeaders,
      body: JSON.stringify({
        channel: channel_id,
        timestamp: timestamp,
        name: reaction,
      }),
    });

    return response.json();
  }

  async getChannelHistory(
    channel_id: string,
    limit: number = 10
  ): Promise<any> {
    const params = new URLSearchParams({
      channel: channel_id,
      limit: limit.toString(),
    });

    const response = await fetch(
      `https://slack.com/api/conversations.history?${params}`,
      { headers: this.botHeaders }
    );

    return response.json();
  }

  async getThreadReplies(channel_id: string, thread_ts: string): Promise<any> {
    const params = new URLSearchParams({
      channel: channel_id,
      ts: thread_ts,
    });

    const response = await fetch(
      `https://slack.com/api/conversations.replies?${params}`,
      { headers: this.botHeaders }
    );

    return response.json();
  }

  async getUsers(limit: number = 100, cursor?: string): Promise<any> {
    const params = new URLSearchParams({
      limit: Math.min(limit, 200).toString(),
      team_id: this.teamId,
    });

    if (cursor) {
      params.append("cursor", cursor);
    }

    const response = await fetch(`https://slack.com/api/users.list?${params}`, {
      headers: this.botHeaders,
    });

    return response.json();
  }

  async getUserProfile(user_id: string): Promise<any> {
    const params = new URLSearchParams({
      user: user_id,
      include_labels: "true",
    });

    const response = await fetch(
      `https://slack.com/api/users.profile.get?${params}`,
      { headers: this.botHeaders }
    );

    return response.json();
  }
}

class SlackPlugin {
  private name: string;
  private version: string;
  private description: string;
  private dependencies: string[];
  private context: any;
  private slackClient: SlackClient | null;

  constructor() {
    this.name = "slack";
    this.version = "1.0.0";
    this.description = "A plugin for interacting with Slack workspaces";
    this.dependencies = [];
    this.slackClient = null;
  }

  async initialize(context: any): Promise<void> {
    this.context = context;

    const botToken = process.env.SLACK_BOT_TOKEN || "";
    const teamId = process.env.SLACK_TEAM_ID || "";

    if (!botToken || !teamId) {
      throw new Error(
        "Slack credentials not found. Please set SLACK_BOT_TOKEN and SLACK_TEAM_ID environment variables."
      );
    }

    this.slackClient = new SlackClient(botToken, teamId);
    context.logger.info("Slack plugin initialized successfully");
  }

  getTools(): Array<any> {
    return [
      {
        name: "list_channels",
        description: "List public channels in the workspace with pagination",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description:
                "Maximum number of channels to return (default 100, max 200)",
              default: 100,
            },
            cursor: {
              type: "string",
              description: "Pagination cursor for next page of results",
            },
          },
        },
      },
      {
        name: "post_message",
        description: "Post a new message to a Slack channel",
        inputSchema: {
          type: "object",
          properties: {
            channel_id: {
              type: "string",
              description: "The ID of the channel to post to",
            },
            text: {
              type: "string",
              description: "The message text to post",
            },
          },
          required: ["channel_id", "text"],
        },
      },
      {
        name: "reply_to_thread",
        description: "Reply to a specific message thread in Slack",
        inputSchema: {
          type: "object",
          properties: {
            channel_id: {
              type: "string",
              description: "The ID of the channel containing the thread",
            },
            thread_ts: {
              type: "string",
              description:
                "The timestamp of the parent message in the format '1234567890.123456'. Timestamps in the format without the period can be converted by adding the period such that 6 numbers come after it.",
            },
            text: {
              type: "string",
              description: "The reply text",
            },
          },
          required: ["channel_id", "thread_ts", "text"],
        },
      },
      {
        name: "add_reaction",
        description: "Add a reaction emoji to a message",
        inputSchema: {
          type: "object",
          properties: {
            channel_id: {
              type: "string",
              description: "The ID of the channel containing the message",
            },
            timestamp: {
              type: "string",
              description: "The timestamp of the message to react to",
            },
            reaction: {
              type: "string",
              description: "The name of the emoji reaction (without ::)",
            },
          },
          required: ["channel_id", "timestamp", "reaction"],
        },
      },
      {
        name: "get_channel_history",
        description: "Get recent messages from a channel",
        inputSchema: {
          type: "object",
          properties: {
            channel_id: {
              type: "string",
              description: "The ID of the channel",
            },
            limit: {
              type: "number",
              description: "Number of messages to retrieve (default 10)",
              default: 10,
            },
          },
          required: ["channel_id"],
        },
      },
      {
        name: "get_thread_replies",
        description: "Get all replies in a message thread",
        inputSchema: {
          type: "object",
          properties: {
            channel_id: {
              type: "string",
              description: "The ID of the channel containing the thread",
            },
            thread_ts: {
              type: "string",
              description:
                "The timestamp of the parent message in the format '1234567890.123456'. Timestamps in the format without the period can be converted by adding the period such that 6 numbers come after it.",
            },
          },
          required: ["channel_id", "thread_ts"],
        },
      },
      {
        name: "get_users",
        description:
          "Get a list of all users in the workspace with their basic profile information",
        inputSchema: {
          type: "object",
          properties: {
            cursor: {
              type: "string",
              description: "Pagination cursor for next page of results",
            },
            limit: {
              type: "number",
              description:
                "Maximum number of users to return (default 100, max 200)",
              default: 100,
            },
          },
        },
      },
      {
        name: "get_user_profile",
        description: "Get detailed profile information for a specific user",
        inputSchema: {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "The ID of the user",
            },
          },
          required: ["user_id"],
        },
      },
    ];
  }

  getResources(): Array<any> {
    return [];
  }

  async executeTool(name: string, args: any): Promise<any> {
    if (!this.context || !this.slackClient) {
      throw new Error("Plugin not properly initialized");
    }

    try {
      switch (name) {
        case "list_channels": {
          const { limit, cursor } = args as ListChannelsArgs;
          const response = await this.slackClient.getChannels(limit, cursor);
          return {
            content: [
              { type: "text", text: JSON.stringify(response, null, 2) },
            ],
          };
        }

        case "post_message": {
          const { channel_id, text } = args as PostMessageArgs;
          if (!channel_id || !text) {
            throw new Error("Missing required arguments: channel_id and text");
          }
          const response = await this.slackClient.postMessage(channel_id, text);
          return {
            content: [
              { type: "text", text: JSON.stringify(response, null, 2) },
            ],
          };
        }

        case "reply_to_thread": {
          const { channel_id, thread_ts, text } = args as ReplyToThreadArgs;
          if (!channel_id || !thread_ts || !text) {
            throw new Error(
              "Missing required arguments: channel_id, thread_ts, and text"
            );
          }
          const response = await this.slackClient.postReply(
            channel_id,
            thread_ts,
            text
          );
          return {
            content: [
              { type: "text", text: JSON.stringify(response, null, 2) },
            ],
          };
        }

        case "add_reaction": {
          const { channel_id, timestamp, reaction } = args as AddReactionArgs;
          if (!channel_id || !timestamp || !reaction) {
            throw new Error(
              "Missing required arguments: channel_id, timestamp, and reaction"
            );
          }
          const response = await this.slackClient.addReaction(
            channel_id,
            timestamp,
            reaction
          );
          return {
            content: [
              { type: "text", text: JSON.stringify(response, null, 2) },
            ],
          };
        }

        case "get_channel_history": {
          const { channel_id, limit } = args as GetChannelHistoryArgs;
          if (!channel_id) {
            throw new Error("Missing required argument: channel_id");
          }
          const response = await this.slackClient.getChannelHistory(
            channel_id,
            limit
          );
          return {
            content: [
              { type: "text", text: JSON.stringify(response, null, 2) },
            ],
          };
        }

        case "get_thread_replies": {
          const { channel_id, thread_ts } = args as GetThreadRepliesArgs;
          if (!channel_id || !thread_ts) {
            throw new Error(
              "Missing required arguments: channel_id and thread_ts"
            );
          }
          const response = await this.slackClient.getThreadReplies(
            channel_id,
            thread_ts
          );
          return {
            content: [
              { type: "text", text: JSON.stringify(response, null, 2) },
            ],
          };
        }

        case "get_users": {
          const { limit, cursor } = args as GetUsersArgs;
          const response = await this.slackClient.getUsers(limit, cursor);
          return {
            content: [
              { type: "text", text: JSON.stringify(response, null, 2) },
            ],
          };
        }

        case "get_user_profile": {
          const { user_id } = args as GetUserProfileArgs;
          if (!user_id) {
            throw new Error("Missing required argument: user_id");
          }
          const response = await this.slackClient.getUserProfile(user_id);
          return {
            content: [
              { type: "text", text: JSON.stringify(response, null, 2) },
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
            text: JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            }),
          },
        ],
      };
    }
  }

  async cleanup(): Promise<void> {
    if (this.context) {
      this.context.logger.info("Slack plugin cleaned up");
      this.context = null;
      this.slackClient = null;
    }
  }
}

module.exports = SlackPlugin;
