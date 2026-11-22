import {
  Agent,
  FunctionTool,
  Model,
  ModelContentBlockDeltaEvent,
  ModelContentBlockStartEvent,
  ModelContentBlockStopEvent,
  ModelMessageStartEvent,
  ModelMessageStopEvent,
  type BaseModelConfig,
  type JSONValue,
  type ModelStreamEvent,
} from '@strands-agents/sdk';
import { choice, createJevClient, request, type JevClient } from '@sandi/jev';
import { createModelFromEnvironment } from './ollama-model.js';

export type AgentStep = {
  kind: 'task' | 'plan' | 'jev-check' | 'action' | 'result' | 'error';
  message: string;
  probabilities?: { yes: number; no: number };
  status?: 'simulated';
};

export interface JevAgentResult {
  outcome: 'acted' | 'refused' | 'error';
  confidence?: number;
  agentMode: 'scripted' | 'ollama';
  steps: AgentStep[];
}

interface RunJevAgentOptions {
  task: string;
  action: string;
  jev: JevClient;
  threshold?: number;
  environment?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  timeoutMs?: number;
  model?: Model<BaseModelConfig>;
}

export const JEV_AGENT_MAX_TURNS = 5;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

interface AgentDecision {
  outcome: JevAgentResult['outcome'];
  confidence?: number;
  probabilities?: { yes: number; no: number };
  message: string;
}

class ScriptedAgentModel extends Model<BaseModelConfig> {
  private config: BaseModelConfig = { modelId: 'scripted-agent' };
  private calls = 0;

  updateConfig(config: BaseModelConfig): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): BaseModelConfig {
    return { ...this.config };
  }

  async *stream(): AsyncIterable<ModelStreamEvent> {
    this.calls += 1;
    yield new ModelMessageStartEvent({ type: 'modelMessageStartEvent', role: 'assistant' });
    if (this.calls === 1) {
      yield new ModelContentBlockStartEvent({ type: 'modelContentBlockStartEvent', start: { type: 'toolUseStart', name: 'jev_gated_action', toolUseId: 'scripted-jev-action' } });
      yield new ModelContentBlockDeltaEvent({ type: 'modelContentBlockDeltaEvent', delta: { type: 'toolUseInputDelta', input: '{}' } });
      yield new ModelContentBlockStopEvent({ type: 'modelContentBlockStopEvent' });
      yield new ModelMessageStopEvent({ type: 'modelMessageStopEvent', stopReason: 'toolUse' });
      return;
    }
    yield new ModelContentBlockStartEvent({ type: 'modelContentBlockStartEvent' });
    yield new ModelContentBlockDeltaEvent({ type: 'modelContentBlockDeltaEvent', delta: { type: 'textDelta', text: 'The Jev check is complete. The action was simulated only when it passed the confidence gate.' } });
    yield new ModelContentBlockStopEvent({ type: 'modelContentBlockStopEvent' });
    yield new ModelMessageStopEvent({ type: 'modelMessageStopEvent', stopReason: 'endTurn' });
  }
}

function safeErrorResult(message = 'Jev could not evaluate this action. Try again.'): AgentDecision {
  return { outcome: 'error', message };
}

function toToolResult(decision: AgentDecision): JSONValue {
  return {
    outcome: decision.outcome,
    message: decision.message,
    ...(decision.confidence === undefined ? {} : { confidence: decision.confidence }),
    ...(decision.probabilities ? { probabilities: decision.probabilities } : {}),
  };
}

export async function runJevAgent(options: RunJevAgentOptions): Promise<JevAgentResult> {
  const threshold = options.threshold ?? 0.8;
  const steps: AgentStep[] = [
    { kind: 'task', message: options.task },
    { kind: 'plan', message: 'Ask Jev to check the proposed action before simulating it.' },
  ];
  let decision: AgentDecision | undefined;
  let toolIterations = 0;
  const failureController = new AbortController();
  const timeoutSignal = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
  const cancelSignal = AbortSignal.any([timeoutSignal, failureController.signal, ...(options.signal ? [options.signal] : [])]);
  const gatedAction = new FunctionTool({
    name: 'jev_gated_action',
    description: 'Check the proposed action with Jev, then simulate it only when Jev allows with sufficient confidence.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    callback: async (_input, context) => {
      if (toolIterations >= JEV_AGENT_MAX_TURNS) {
        decision = safeErrorResult(`The agent stopped after reaching the maximum of ${JEV_AGENT_MAX_TURNS} turns. No further Jev checks will be attempted.`);
        steps.push({ kind: 'error', message: decision.message });
        failureController.abort();
        return toToolResult(decision);
      }
      toolIterations += 1;
      try {
        const result = await options.jev.evaluate(request(
          `Task: ${options.task}\nProposed action: ${options.action}`,
          { safe: choice('Is this proposed action safe and authorized to simulate?', {
            yes: 'Safe and authorized; the action may be simulated.',
            no: 'Unsafe, unauthorized, or insufficiently supported; refuse the action.',
          }) },
        ), { signal: context.cancelSignal });
        const answer = result.safe;
        const probabilities = answer.probabilities;
        const allowed = answer.value === 'yes' && probabilities.yes >= threshold;
        decision = {
          outcome: allowed ? 'acted' : 'refused',
          confidence: probabilities.yes,
          probabilities,
          message: allowed
            ? 'Jev allows this action with sufficient confidence.'
            : `Action refused because ${answer.value === 'no' ? 'Jev denied it' : 'confidence is below the threshold'}.`,
        };
        steps.push({ kind: 'jev-check', message: decision.message, probabilities });
        if (allowed) {
          steps.push({ kind: 'action', message: options.action, status: 'simulated' });
          steps.push({ kind: 'result', message: 'The action was simulated after Jev allowed it.' });
        } else {
          steps.push({ kind: 'result', message: `${decision.message} No action was taken.` });
        }
        return toToolResult(decision);
      } catch {
        decision = timeoutSignal.aborted
          ? safeErrorResult('The agent request timed out. Try again.')
          : safeErrorResult();
        steps.push({ kind: 'error', message: decision.message });
        failureController.abort();
        return toToolResult(decision);
      }
    },
  });

  const environment = options.environment ?? process.env;
  const selectedModel = createModelFromEnvironment(environment);
  const agent = new Agent({
    model: options.model ?? (selectedModel.kind === 'scripted' ? new ScriptedAgentModel() : selectedModel.model),
    tools: [gatedAction],
    systemPrompt: 'You are a careful agent. Use jev_gated_action for the proposed action. Never claim an action was performed unless the tool reports it was simulated.',
  });

  let stopReason: string | undefined;
  try {
    const result = await agent.invoke(`Task: ${options.task}\nProposed action: ${options.action}\nUse the Jev safety tool before responding.`, {
      cancelSignal,
      limits: { turns: JEV_AGENT_MAX_TURNS },
    });
    stopReason = result.stopReason;
  } catch {
    if (!decision) {
      decision = safeErrorResult();
      steps.push({ kind: 'error', message: decision.message });
    }
  }

  if (stopReason === 'limitTurns') {
    decision = safeErrorResult(`The agent stopped after reaching the maximum of ${JEV_AGENT_MAX_TURNS} turns. No further Jev checks will be attempted.`);
    steps.push({ kind: 'error', message: decision.message });
  }
  if (!decision && timeoutSignal.aborted && !options.signal?.aborted) {
    decision = safeErrorResult('The agent request timed out. Try again.');
    steps.push({ kind: 'error', message: decision.message });
  }
  if (!decision) {
    decision = { outcome: 'error', message: `The agent stopped before completing a Jev safety check (maximum ${JEV_AGENT_MAX_TURNS} turns).` };
    steps.push({ kind: 'error', message: decision.message });
  }
  return {
    outcome: decision.outcome,
    ...(decision.confidence === undefined ? {} : { confidence: decision.confidence }),
    agentMode: selectedModel.kind,
    steps,
  };
}

export function createJevClientFromEnvironment(environment: NodeJS.ProcessEnv): JevClient {
  const live = environment.JEV_MODE === 'live' && Boolean(environment.TYPESAFE_API_KEY) && environment.NODE_ENV !== 'test';
  return createJevClient({ mode: live ? 'live' : 'mock', apiKey: live ? environment.TYPESAFE_API_KEY : undefined });
}
