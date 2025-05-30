interface SentryIssueData {
  title: string;
  issue_id: string;
  status: string;
  level: string;
  first_seen: string;
  last_seen: string;
  count: number;
  stacktrace: string;
}

interface SentryIssue {
  title: string;
  status: string;
  level: string;
  firstSeen: string;
  lastSeen: string;
  count: number;
}

interface SentryEvent {
  entries: Array<{
    type: string;
    data: {
      values: Array<{
        type?: string;
        value?: string;
        stacktrace?: {
          frames: Array<{
            filename?: string;
            lineNo?: number;
            function?: string;
            context?: Array<[number, string]>;
          }>;
        };
      }>;
    };
  }>;
}

interface SentryHash {
  latestEvent: SentryEvent;
}

class SentryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SentryError";
  }
}

class SentryPlugin {
  private name: string;
  private version: string;
  private description: string;
  private dependencies: string[];
  private context: any;
  private authToken: string;
  private baseUrl: string;

  constructor() {
    this.name = "sentry";
    this.version = "1.0.0";
    this.description = "A plugin for fetching and analyzing Sentry issues";
    this.dependencies = [];
    this.authToken = "";
    this.baseUrl = "https://sentry.io/api/0/";
  }

  async initialize(context: any): Promise<void> {
    this.context = context;

    // Get auth token from environment or context
    this.authToken =
      process.env.SENTRY_AUTH_TOKEN || process.env.MCP_SENTRY_AUTH_TOKEN || "";

    if (!this.authToken) {
      throw new Error(
        "Sentry authentication token not found. Please set SENTRY_AUTH_TOKEN or MCP_SENTRY_AUTH_TOKEN environment variable."
      );
    }

    context.logger.info("Sentry plugin initialized successfully");
  }

  getTools(): Array<any> {
    return [
      {
        name: "get_sentry_issue",
        description:
          "Retrieve and analyze a Sentry issue by ID or URL. Use this tool when you need to investigate production errors and crashes, access detailed stacktraces from Sentry, analyze error patterns and frequencies, get information about when issues first/last occurred, or review error counts and status.",
        inputSchema: {
          type: "object",
          properties: {
            issue_id_or_url: {
              type: "string",
              description: "Sentry issue ID or URL to analyze",
            },
          },
          required: ["issue_id_or_url"],
        },
      },
    ];
  }

  getResources(): Array<any> {
    return [];
  }

  private extractIssueId(issueIdOrUrl: string): string {
    if (!issueIdOrUrl) {
      throw new SentryError("Missing issue_id_or_url argument");
    }

    if (
      issueIdOrUrl.startsWith("http://") ||
      issueIdOrUrl.startsWith("https://")
    ) {
      try {
        const url = new URL(issueIdOrUrl);

        if (!url.hostname || !url.hostname.endsWith(".sentry.io")) {
          throw new SentryError(
            "Invalid Sentry URL. Must be a URL ending with .sentry.io"
          );
        }

        const pathParts = url.pathname
          .trim()
          .replace(/^\/|\/$/g, "")
          .split("/");

        if (pathParts.length < 2 || pathParts[0] !== "issues") {
          throw new SentryError(
            "Invalid Sentry issue URL. Path must contain '/issues/{issue_id}'"
          );
        }

        const issueId = pathParts[pathParts.length - 1];

        if (!/^\d+$/.test(issueId)) {
          throw new SentryError(
            "Invalid Sentry issue ID. Must be a numeric value."
          );
        }

        return issueId;
      } catch (error) {
        if (error instanceof SentryError) {
          throw error;
        }
        throw new SentryError("Invalid URL format");
      }
    } else {
      if (!/^\d+$/.test(issueIdOrUrl)) {
        throw new SentryError(
          "Invalid Sentry issue ID. Must be a numeric value."
        );
      }
      return issueIdOrUrl;
    }
  }

  private createStacktrace(latestEvent: SentryEvent): string {
    const stacktraces: string[] = [];

    for (const entry of latestEvent.entries || []) {
      if (entry.type !== "exception") {
        continue;
      }

      const exceptionData = entry.data.values;
      for (const exception of exceptionData) {
        const exceptionType = exception.type || "Unknown";
        const exceptionValue = exception.value || "";
        const stacktrace = exception.stacktrace;

        let stacktraceText = `Exception: ${exceptionType}: ${exceptionValue}\n\n`;

        if (stacktrace) {
          stacktraceText += "Stacktrace:\n";
          for (const frame of stacktrace.frames || []) {
            const filename = frame.filename || "Unknown";
            const lineno = frame.lineNo || "?";
            const functionName = frame.function || "Unknown";

            stacktraceText += `${filename}:${lineno} in ${functionName}\n`;

            if (frame.context) {
              for (const ctxLine of frame.context) {
                stacktraceText += `    ${ctxLine[1]}\n`;
              }
            }

            stacktraceText += "\n";
          }
        }

        stacktraces.push(stacktraceText);
      }
    }

    return stacktraces.length > 0
      ? stacktraces.join("\n")
      : "No stacktrace found";
  }

  private formatIssueData(issueData: SentryIssueData): string {
    return `
Sentry Issue: ${issueData.title}
Issue ID: ${issueData.issue_id}
Status: ${issueData.status}
Level: ${issueData.level}
First Seen: ${issueData.first_seen}
Last Seen: ${issueData.last_seen}
Event Count: ${issueData.count}

${issueData.stacktrace}
    `.trim();
  }

  private async handleSentryIssue(
    issueIdOrUrl: string
  ): Promise<SentryIssueData> {
    try {
      const issueId = this.extractIssueId(issueIdOrUrl);

      // Fetch issue data
      const issueResponse = await fetch(`${this.baseUrl}issues/${issueId}/`, {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
          "Content-Type": "application/json",
        },
      });

      if (issueResponse.status === 401) {
        throw new Error(
          "Error: Unauthorized. Please check your SENTRY_AUTH_TOKEN token."
        );
      }

      if (!issueResponse.ok) {
        throw new Error(
          `Error fetching Sentry issue: ${issueResponse.status} ${issueResponse.statusText}`
        );
      }

      const issueData: SentryIssue = await issueResponse.json();

      // Get issue hashes to get the latest event
      const hashesResponse = await fetch(
        `${this.baseUrl}issues/${issueId}/hashes/`,
        {
          headers: {
            Authorization: `Bearer ${this.authToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!hashesResponse.ok) {
        throw new Error(
          `Error fetching Sentry issue hashes: ${hashesResponse.status} ${hashesResponse.statusText}`
        );
      }

      const hashes: SentryHash[] = await hashesResponse.json();

      if (!hashes || hashes.length === 0) {
        throw new Error("No Sentry events found for this issue");
      }

      const latestEvent = hashes[0].latestEvent;
      const stacktrace = this.createStacktrace(latestEvent);

      return {
        title: issueData.title,
        issue_id: issueId,
        status: issueData.status,
        level: issueData.level,
        first_seen: issueData.firstSeen,
        last_seen: issueData.lastSeen,
        count: issueData.count,
        stacktrace: stacktrace,
      };
    } catch (error) {
      if (error instanceof SentryError) {
        throw new Error(error.message);
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`An error occurred: ${String(error)}`);
    }
  }

  async executeTool(name: string, args: any): Promise<any> {
    if (!this.context) {
      throw new Error("Plugin not properly initialized");
    }

    switch (name) {
      case "get_sentry_issue":
        if (!args.issue_id_or_url) {
          throw new Error("Missing issue_id_or_url argument");
        }

        const issueData = await this.handleSentryIssue(args.issue_id_or_url);
        return {
          content: [
            {
              type: "text",
              text: this.formatIssueData(issueData),
            },
          ],
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async cleanup(): Promise<void> {
    if (this.context) {
      this.context.logger.info("Sentry plugin cleaned up");
      this.context = null;
    }
  }
}

module.exports = SentryPlugin;
