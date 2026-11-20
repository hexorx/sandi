/** The app's normalized engine result shape; structurally matches packages/decider/src/types.ts. */
export type EngineSelection = 'jev' | 'decider';
export type EngineId = EngineSelection | 'mock';

export interface DecisionInput {
  useCase: string;
  payload: unknown;
}

export interface DecisionResult {
  answer: unknown;
  confidence: Readonly<Record<string, number>>;
  explanation?: string;
}

export interface DecisionEngine {
  readonly id: EngineId;
  decide(input: DecisionInput): Promise<DecisionResult>;
}

export interface EngineRun extends DecisionResult {
  requestedEngine: EngineSelection;
  engine: EngineId;
  latencyMs: number;
  fallback?: { reason: 'unconfigured' | 'unreachable' | 'provider-error' };
}
