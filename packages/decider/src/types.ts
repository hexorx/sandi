/** Provider-neutral contracts for application decisions. */

export type EngineId = "jev" | "decider" | "mock";
export type EngineSelection = Exclude<EngineId, "mock">;

export type DecisionConfidence = Readonly<Record<string, number>>;

export interface DecisionInput {
  /** Stable use-case identifier, such as "tool-safety" or "ticket-triage". */
  useCase: string;
  /** Validated, use-case-specific input. Provider adapters must not reinterpret it. */
  payload: unknown;
}

export interface DecisionResult {
  /** Provider-normalized answer consumed by the use-case page. */
  answer: unknown;
  /** Named confidence/probability values in the range [0, 1]. */
  confidence: DecisionConfidence;
  /** Safe, optional explanation for the result. */
  explanation?: string;
}

export interface EngineRunOptions {
  signal?: AbortSignal;
}

export interface DecisionEngine {
  readonly id: EngineId;
  decide(input: DecisionInput, options?: EngineRunOptions): Promise<DecisionResult>;
}

export interface EngineAvailability {
  readonly id: EngineSelection;
  readonly available: boolean;
  /** Safe UI explanation; must not include URLs, keys, or provider error text. */
  readonly reason?: string;
}

export interface EngineRun extends DecisionResult {
  /** Engine requested by the page or compare dispatcher. */
  readonly requestedEngine: EngineSelection;
  /** Engine that actually produced the result, including mock on fallback. */
  readonly engine: EngineId;
  /** Adapter duration in milliseconds, measured server-side. */
  readonly latencyMs: number;
  /** Present when a mock/scripted result replaces the requested provider. */
  readonly fallback?: {
    readonly reason: "unconfigured" | "unreachable" | "provider-error";
  };
}

export interface EngineRunFailure {
  /** Engine requested by the page or compare dispatcher. */
  readonly requestedEngine: EngineSelection;
  readonly engine: EngineSelection;
  readonly latencyMs: number;
  /** Safe, stable error identifier; never raw provider error text. */
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

export type EngineRunResult = EngineRun | EngineRunFailure;

export interface CompareResult {
  readonly mode: "compare";
  readonly results: Readonly<Record<EngineSelection, EngineRunResult>>;
}

export interface SelectedEngineResult {
  readonly mode: "single";
  readonly result: EngineRunResult;
}

export type DecisionExecution = CompareResult | SelectedEngineResult;

export interface DecisionEngineRegistry {
  readonly jev: DecisionEngine;
  readonly decider: DecisionEngine;
  readonly mock: DecisionEngine;
}
