# @tracelyx/core

Minimal observability SDK for AI agents. Zero dependencies, < 20KB gzip.

## Install

```bash
npm install @tracelyx/core
```

## Quickstart

```typescript
import { TracelyxClient, instrumentAnthropic } from '@tracelyx/core';
import Anthropic from '@anthropic-ai/sdk';

const tracelyx = new TracelyxClient({ apiKey: 'tl_...', projectId: 'my-project' });
const anthropic = new Anthropic();
instrumentAnthropic(anthropic, tracelyx);

// All anthropic.messages.create() calls are now traced automatically
```

## Manual tracing

```typescript
const trace = tracelyx.startTrace({ name: 'process-request', tenantId: 'acme-corp' });

const result = await trace.trace('fetch-context', async () => {
  return fetchUserContext(userId);
});

await tracelyx.flush(); // call once at process exit
```

## Integrations

| Function | Library |
|---|---|
| `instrumentAnthropic(client, tracelyx)` | `@anthropic-ai/sdk` |
| `instrumentLangGraph(graph, tracelyx)` | `@langchain/langgraph` |
| `instrumentOpenAIAgents(agent, tracelyx)` | `@openai/agents` |

## CLI

```bash
# Verify configuration
npx tracelyx validate --api-key tl_xxx --project-id my-project

# Claude Code hooks listener
TRACELYX_API_KEY=tl_xxx TRACELYX_PROJECT_ID=my-project npx tracelyx hook-listener
```

Claude Code `.claude/settings.json`:
```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "tracelyx hook --event PreToolUse" }] }],
    "PostToolUse": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "tracelyx hook --event PostToolUse" }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "tracelyx hook --event Stop" }] }]
  }
}
```
