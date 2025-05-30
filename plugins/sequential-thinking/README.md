# Sequential Thinking Plugin

A comprehensive TypeScript plugin for dynamic and reflective problem-solving through sequential thoughts. This plugin helps analyze complex problems through a flexible thinking process that can adapt and evolve as understanding deepens.

## Features

- **Dynamic thought sequences** - Adjust the number of thoughts as you progress
- **Revision capabilities** - Question or revise previous thoughts
- **Branching logic** - Explore alternative approaches
- **Context preservation** - Maintain history across multiple thinking steps
- **Formatted output** - Beautiful visual representation of thought processes
- **History management** - Track and review complete thought processes
- **No external dependencies** - Self-contained implementation

## Setup

This plugin requires no external dependencies or environment variables. It's ready to use once loaded and enabled in your MCP plugin server.

## Usage

### Available Tools

#### 1. `sequential_thinking`

The main tool for processing sequential thoughts with dynamic problem-solving capabilities.

**Required Parameters:**

- `thought` (string): Your current thinking step
- `nextThoughtNeeded` (boolean): Whether another thought step is needed
- `thoughtNumber` (integer): Current thought number (minimum: 1)
- `totalThoughts` (integer): Estimated total thoughts needed (minimum: 1)

**Optional Parameters:**

- `isRevision` (boolean): Whether this revises previous thinking
- `revisesThought` (integer): Which thought number is being reconsidered
- `branchFromThought` (integer): Branching point thought number
- `branchId` (string): Branch identifier for tracking different paths
- `needsMoreThoughts` (boolean): If more thoughts are needed beyond the initial estimate

#### 2. `get_thought_history`

Retrieve the complete history of thoughts processed in the current session.

**Parameters:** None required

#### 3. `clear_thought_history`

Clear the thought history and start fresh.

**Parameters:** None required

## When to Use Sequential Thinking

This tool is ideal for:

- **Complex problem breakdown** - Breaking down multi-step problems
- **Planning and design** - Projects that need room for revision
- **Analytical tasks** - Analysis that might require course correction
- **Uncertain scope problems** - When the full problem scope isn't clear initially
- **Multi-step solutions** - Problems requiring sequential reasoning
- **Context-dependent tasks** - Tasks needing context across multiple steps
- **Information filtering** - Situations where irrelevant information needs filtering

## Key Features and Capabilities

### Dynamic Adjustment

- Start with an estimate of needed thoughts, but adjust as you progress
- Increase or decrease `totalThoughts` based on evolving understanding
- Add more thoughts even after reaching what seemed like the end

### Revision and Branching

- Question or revise previous thoughts using `isRevision: true`
- Specify which thought you're revising with `revisesThought`
- Create alternative solution paths with `branchFromThought` and `branchId`
- Explore multiple approaches to the same problem

### Flexible Progress

- Express uncertainty when present
- Mark thoughts that revise previous thinking
- Ignore irrelevant information at each step
- Generate and verify solution hypotheses
- Iterate until a satisfactory solution is reached

## Tool Name Examples

When using through the MCP plugin server, tools are prefixed with the plugin name:

- `sequential-thinking.sequential_thinking`
- `sequential-thinking.get_thought_history`
- `sequential-thinking.clear_thought_history`

## Example Usage

### Basic Sequential Thinking

```typescript
// First thought
await plugin.executeTool("sequential_thinking", {
  thought:
    "I need to analyze the user's request and break it down into components",
  thoughtNumber: 1,
  totalThoughts: 3,
  nextThoughtNeeded: true,
});

// Second thought
await plugin.executeTool("sequential_thinking", {
  thought:
    "The request has three main parts: data processing, analysis, and visualization",
  thoughtNumber: 2,
  totalThoughts: 3,
  nextThoughtNeeded: true,
});

// Final thought
await plugin.executeTool("sequential_thinking", {
  thought: "I can create a pipeline that handles each part sequentially",
  thoughtNumber: 3,
  totalThoughts: 3,
  nextThoughtNeeded: false,
});
```

### Revision Example

```typescript
// Revising a previous thought
await plugin.executeTool("sequential_thinking", {
  thought:
    "Actually, I think my analysis in step 2 was incomplete. The visualization component is more complex than I initially thought.",
  thoughtNumber: 4,
  totalThoughts: 5,
  isRevision: true,
  revisesThought: 2,
  nextThoughtNeeded: true,
});
```

### Branching Example

```typescript
// Creating a branch from a previous thought
await plugin.executeTool("sequential_thinking", {
  thought: "Let me explore an alternative approach to data processing",
  thoughtNumber: 1,
  totalThoughts: 3,
  branchFromThought: 2,
  branchId: "alternative_processing",
  nextThoughtNeeded: true,
});
```

### History Management

```typescript
// Get complete thought history
await plugin.executeTool("get_thought_history", {});

// Clear history to start fresh
await plugin.executeTool("clear_thought_history", {});
```

## Output Format

The plugin returns structured JSON responses containing:

- **Thought tracking**: Current thought number, total thoughts, next thought status
- **Branch information**: Active branches and their identifiers
- **Formatted display**: Visual representation of the thought process
- **History metadata**: Total thoughts processed, branch counts

### Visual Formatting

Each thought is displayed with borders and visual indicators:

```
┌─────────────────────────────────────────┐
│ 💭 Thought 1/3                         │
├─────────────────────────────────────────┤
│ Analyzing the problem requirements...   │
└─────────────────────────────────────────┘
```

Special indicators:

- 💭 **Thought** - Regular thinking step
- 🔄 **Revision** - Revising previous thought
- 🌿 **Branch** - Alternative solution path

## Best Practices

1. **Start with estimates** - Begin with a rough estimate of needed thoughts
2. **Be ready to adjust** - Don't hesitate to change `totalThoughts`
3. **Use revisions** - Question and improve previous thinking
4. **Express uncertainty** - It's okay to be unsure and explore
5. **Branch when needed** - Explore alternative approaches
6. **Filter information** - Ignore irrelevant details at each step
7. **Verify hypotheses** - Test your solution ideas
8. **Iterate until satisfied** - Only set `nextThoughtNeeded: false` when truly done
9. **Use history tools** - Review your thinking process when needed
10. **Clear history** - Start fresh for new problem domains

## Error Handling

The plugin includes comprehensive error handling for:

- Invalid parameter types
- Missing required fields
- Malformed input data
- Processing errors

All errors are returned in a structured format with clear error messages.

## Integration

This plugin integrates seamlessly with your MCP plugin server and requires no external services or API keys. It maintains state within the plugin instance and can be used alongside other plugins for comprehensive problem-solving workflows.
