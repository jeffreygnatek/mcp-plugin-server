interface ThoughtData {
  thought: string;
  thoughtNumber: number;
  totalThoughts: number;
  isRevision?: boolean;
  revisesThought?: number;
  branchFromThought?: number;
  branchId?: string;
  needsMoreThoughts?: boolean;
  nextThoughtNeeded: boolean;
}

class SequentialThinkingCore {
  private thoughtHistory: ThoughtData[] = [];
  private branches: Record<string, ThoughtData[]> = {};

  private validateThoughtData(input: unknown): ThoughtData {
    const data = input as Record<string, unknown>;

    if (!data.thought || typeof data.thought !== "string") {
      throw new Error("Invalid thought: must be a string");
    }
    if (!data.thoughtNumber || typeof data.thoughtNumber !== "number") {
      throw new Error("Invalid thoughtNumber: must be a number");
    }
    if (!data.totalThoughts || typeof data.totalThoughts !== "number") {
      throw new Error("Invalid totalThoughts: must be a number");
    }
    if (typeof data.nextThoughtNeeded !== "boolean") {
      throw new Error("Invalid nextThoughtNeeded: must be a boolean");
    }

    return {
      thought: data.thought,
      thoughtNumber: data.thoughtNumber,
      totalThoughts: data.totalThoughts,
      nextThoughtNeeded: data.nextThoughtNeeded,
      isRevision: data.isRevision as boolean | undefined,
      revisesThought: data.revisesThought as number | undefined,
      branchFromThought: data.branchFromThought as number | undefined,
      branchId: data.branchId as string | undefined,
      needsMoreThoughts: data.needsMoreThoughts as boolean | undefined,
    };
  }

  private formatThought(thoughtData: ThoughtData): string {
    const {
      thoughtNumber,
      totalThoughts,
      thought,
      isRevision,
      revisesThought,
      branchFromThought,
      branchId,
    } = thoughtData;

    let prefix = "";
    let context = "";

    if (isRevision) {
      prefix = "🔄 Revision";
      context = ` (revising thought ${revisesThought})`;
    } else if (branchFromThought) {
      prefix = "🌿 Branch";
      context = ` (from thought ${branchFromThought}, ID: ${branchId})`;
    } else {
      prefix = "💭 Thought";
      context = "";
    }

    const header = `${prefix} ${thoughtNumber}/${totalThoughts}${context}`;
    const border = "─".repeat(Math.max(header.length, thought.length) + 4);

    return `
┌${border}┐
│ ${header} │
├${border}┤
│ ${thought.padEnd(border.length - 2)} │
└${border}┘`;
  }

  public processThought(input: unknown): {
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  } {
    try {
      const validatedInput = this.validateThoughtData(input);

      if (validatedInput.thoughtNumber > validatedInput.totalThoughts) {
        validatedInput.totalThoughts = validatedInput.thoughtNumber;
      }

      this.thoughtHistory.push(validatedInput);

      if (validatedInput.branchFromThought && validatedInput.branchId) {
        if (!this.branches[validatedInput.branchId]) {
          this.branches[validatedInput.branchId] = [];
        }
        this.branches[validatedInput.branchId].push(validatedInput);
      }

      const formattedThought = this.formatThought(validatedInput);
      console.log(formattedThought); // Changed from console.error to console.log

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                thoughtNumber: validatedInput.thoughtNumber,
                totalThoughts: validatedInput.totalThoughts,
                nextThoughtNeeded: validatedInput.nextThoughtNeeded,
                branches: Object.keys(this.branches),
                thoughtHistoryLength: this.thoughtHistory.length,
                formattedThought: formattedThought,
              },
              null,
              2
            ),
          },
        ],
      };
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

  public getThoughtHistory(): ThoughtData[] {
    return [...this.thoughtHistory];
  }

  public getBranches(): Record<string, ThoughtData[]> {
    return { ...this.branches };
  }

  public clearHistory(): void {
    this.thoughtHistory = [];
    this.branches = {};
  }
}

class SequentialThinkingPlugin {
  private name: string;
  private version: string;
  private description: string;
  private dependencies: string[];
  private context: any;
  private thinkingCore: SequentialThinkingCore;

  constructor() {
    this.name = "sequential-thinking";
    this.version = "1.0.0";
    this.description =
      "A plugin for dynamic and reflective problem-solving through sequential thoughts";
    this.dependencies = [];
    this.thinkingCore = new SequentialThinkingCore();
  }

  async initialize(context: any): Promise<void> {
    this.context = context;
    context.logger.info("Sequential Thinking plugin initialized successfully");
  }

  getTools(): Array<any> {
    return [
      {
        name: "sequential_thinking",
        description: `A detailed tool for dynamic and reflective problem-solving through thoughts.
This tool helps analyze problems through a flexible thinking process that can adapt and evolve.
Each thought can build on, question, or revise previous insights as understanding deepens.

When to use this tool:
- Breaking down complex problems into steps
- Planning and design with room for revision
- Analysis that might need course correction
- Problems where the full scope might not be clear initially
- Problems that require a multi-step solution
- Tasks that need to maintain context over multiple steps
- Situations where irrelevant information needs to be filtered out

Key features:
- You can adjust total_thoughts up or down as you progress
- You can question or revise previous thoughts
- You can add more thoughts even after reaching what seemed like the end
- You can express uncertainty and explore alternative approaches
- Not every thought needs to build linearly - you can branch or backtrack
- Generates a solution hypothesis
- Verifies the hypothesis based on the Chain of Thought steps
- Repeats the process until satisfied
- Provides a correct answer

Parameters explained:
- thought: Your current thinking step, which can include:
  * Regular analytical steps
  * Revisions of previous thoughts
  * Questions about previous decisions
  * Realizations about needing more analysis
  * Changes in approach
  * Hypothesis generation
  * Hypothesis verification
- nextThoughtNeeded: True if you need more thinking, even if at what seemed like the end
- thoughtNumber: Current number in sequence (can go beyond initial total if needed)
- totalThoughts: Current estimate of thoughts needed (can be adjusted up/down)
- isRevision: A boolean indicating if this thought revises previous thinking
- revisesThought: If isRevision is true, which thought number is being reconsidered
- branchFromThought: If branching, which thought number is the branching point
- branchId: Identifier for the current branch (if any)
- needsMoreThoughts: If reaching end but realizing more thoughts needed

You should:
1. Start with an initial estimate of needed thoughts, but be ready to adjust
2. Feel free to question or revise previous thoughts
3. Don't hesitate to add more thoughts if needed, even at the "end"
4. Express uncertainty when present
5. Mark thoughts that revise previous thinking or branch into new paths
6. Ignore information that is irrelevant to the current step
7. Generate a solution hypothesis when appropriate
8. Verify the hypothesis based on the Chain of Thought steps
9. Repeat the process until satisfied with the solution
10. Provide a single, ideally correct answer as the final output
11. Only set nextThoughtNeeded to false when truly done and a satisfactory answer is reached`,
        inputSchema: {
          type: "object",
          properties: {
            thought: {
              type: "string",
              description: "Your current thinking step",
            },
            nextThoughtNeeded: {
              type: "boolean",
              description: "Whether another thought step is needed",
            },
            thoughtNumber: {
              type: "integer",
              description: "Current thought number",
              minimum: 1,
            },
            totalThoughts: {
              type: "integer",
              description: "Estimated total thoughts needed",
              minimum: 1,
            },
            isRevision: {
              type: "boolean",
              description: "Whether this revises previous thinking",
            },
            revisesThought: {
              type: "integer",
              description: "Which thought is being reconsidered",
              minimum: 1,
            },
            branchFromThought: {
              type: "integer",
              description: "Branching point thought number",
              minimum: 1,
            },
            branchId: {
              type: "string",
              description: "Branch identifier",
            },
            needsMoreThoughts: {
              type: "boolean",
              description: "If more thoughts are needed",
            },
          },
          required: [
            "thought",
            "nextThoughtNeeded",
            "thoughtNumber",
            "totalThoughts",
          ],
        },
      },
      {
        name: "get_thought_history",
        description:
          "Get the complete history of thoughts processed in the current session",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "clear_thought_history",
        description: "Clear the thought history and start fresh",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ];
  }

  getResources(): Array<any> {
    return [];
  }

  async executeTool(name: string, args: any): Promise<any> {
    if (!this.context) {
      throw new Error("Plugin not properly initialized");
    }

    switch (name) {
      case "sequential_thinking":
        const result = this.thinkingCore.processThought(args);
        return result;

      case "get_thought_history":
        const history = this.thinkingCore.getThoughtHistory();
        const branches = this.thinkingCore.getBranches();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  thoughtHistory: history,
                  branches: branches,
                  totalThoughts: history.length,
                  branchCount: Object.keys(branches).length,
                },
                null,
                2
              ),
            },
          ],
        };

      case "clear_thought_history":
        this.thinkingCore.clearHistory();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: "Thought history cleared successfully",
                  status: "success",
                },
                null,
                2
              ),
            },
          ],
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async cleanup(): Promise<void> {
    if (this.context) {
      this.context.logger.info("Sequential Thinking plugin cleaned up");
      this.context = null;
    }
  }
}

module.exports = SequentialThinkingPlugin;
