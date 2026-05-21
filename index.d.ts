// Type declarations for the `gentzen` package entry point.

export interface RunOptions {
    /** Emit progress and detail logs to the configured logger. */
    verbose?: boolean;
    /** Inline resolvers. Override discovered resolvers of the same name. */
    customResolvers?: Record<string, ResolverFn | unknown>;
    /** Directory of resolver `.js` files to discover via fast-glob. */
    resolversPath?: string;
    /** Validate the scenario before running. Defaults to true. */
    validate?: boolean;
    /** Only run resolvers for atoms referenced by the scenario. Defaults to true. */
    selectiveResolution?: boolean;
    /** Called once per target with proof outcome and timing. May be async. */
    onProof?: OnProofCallback;
}

/**
 * How a target was proved (or null if it wasn't):
 *  - 'fact'      : matches a resolver-produced fact in `availableFacts`.
 *  - 'asserted'  : matches a proposition declared in the scenario YAML —
 *                  the scenario stipulates this; it was NOT derived.
 *                  Consumers gating real-world side effects should refuse
 *                  to act on `'asserted'` targets and require `'inference'`
 *                  or `'derived'` instead.
 *  - 'derived'   : matches a step produced by a rule application during
 *                  YAML step execution (alpha, beta, contraposition,
 *                  doubleNegation, modusPonens).
 *  - 'inference' : derived during the BFS proof search beyond the YAML steps.
 *  - null        : `proven` is false; no derivation was found.
 */
export type ProofDerivation = 'fact' | 'asserted' | 'derived' | 'inference' | null;

/**
 * Identifier for the rule that fired in a single DerivationStep.
 */
export type RuleId =
    | 'and'
    | 'or'
    | 'modusPonens'
    | 'modusTollens'
    | 'contraposition'
    | 'doubleNegIntro'
    | 'doubleNegElim'
    | 'andElimL'
    | 'andElimR'
    | 'orElim'
    | 'disjunctiveMP'
    | 'disjunctiveSyllogism';

/**
 * Where a single premise of a DerivationStep came from.
 *  - 'fact'         : a resolver-produced fact in `availableFacts`.
 *  - 'proposition'  : an axiom declared in the scenario YAML.
 *  - 'derivation'   : another DerivationStep earlier in the path;
 *                     `fromPathIndex` points to its index.
 */
export interface PremiseSource {
    formula: string;
    kind: 'fact' | 'proposition' | 'derivation';
    /** Index into the surrounding path[] for 'derivation' premises; null for leaves. */
    fromPathIndex: number | null;
}

/**
 * One rule application in a structured derivation chain. Each step lists
 * its premises (formula strings), the resulting conclusion, and the source
 * each premise came from. The chain is in dependency order — leaves first,
 * target last. The target's chain entry is the last element.
 */
export interface DerivationStep {
    rule: RuleId;
    premises: string[];
    conclusion: string;
    sources: PremiseSource[];
}

export interface ProofEvent {
    target: string;
    proven: boolean;
    derivation: ProofDerivation;
    /**
     * Structured derivation chain. Empty for 'fact' and 'asserted' targets
     * (they have no derivation to walk). Non-empty for 'derived' and
     * 'inference'.
     */
    path: DerivationStep[];
    missingFacts: string[];
    durationMs: number;
}

export type OnProofCallback = (event: ProofEvent) => void | Promise<void>;

export type ResolverFn = () => boolean | Promise<boolean>;

export interface TargetResult {
    formula: string;
    proven: boolean;
    /**
     * How this target was proved. See {@link ProofDerivation}. Consumers
     * gating real-world side effects should refuse `'asserted'`.
     */
    derivation: ProofDerivation;
    missingFacts: string[];
    /**
     * Structured derivation chain. Empty for 'fact' and 'asserted' targets.
     * Non-empty for 'derived' and 'inference'. See {@link DerivationStep}.
     */
    path: DerivationStep[];
}

export type SkipReason = 'missing_fact' | 'unknown_atom' | 'parse_error';

export interface SkippedStep {
    stepIndex: number;
    rule: string;
    subtype?: string;
    from: string[];
    missingFacts: string[];
    /**
     * Why this step was skipped:
     * - `missing_fact`: one or more `from` atoms could not be resolved.
     * - `unknown_atom`: a `from` formula parsed but matches no fact or step.
     * - `parse_error`: a `from` formula could not be parsed.
     *
     * If multiple causes apply within a single step, priority is
     * `parse_error` > `unknown_atom` > `missing_fact`.
     */
    reason: SkipReason;
}

export interface ResolverError {
    file: string;
    error: string;
}

export interface ReasoningSummary {
    totalTargets: number;
    /**
     * Count of targets where `proven === true`. Includes both inferred and
     * asserted (stipulated) targets. Use `assertedTargets` to subtract out
     * the stipulated ones when reasoning about agent safety.
     */
    provenTargets: number;
    /**
     * Count of `proven` targets whose derivation is `'asserted'` — the
     * scenario declared them as propositions; no inference occurred.
     */
    assertedTargets: number;
    availableFacts: number;
    missingFacts: number;
    skippedSteps: number;
    loadedFiles: string[];
    totalResolvers: number;
}

export interface VerboseInfo {
    loadedFiles: string[];
    factResolutionDetails: Record<string, boolean>;
    resolversPath?: string;
}

export interface Step {
    origin: string;
    ruleType: string;
    from: Step[];
    formulas: Set<string>;
}

/**
 * Read-only introspection handle on the underlying proof system.
 * `steps` and `facts` are stable. Methods on the handle are internal
 * and may change without notice — do not call them.
 */
export interface SystemHandle {
    steps: Step[];
    facts: Set<string>;
}

export interface ReasoningResults {
    scenarioPath: string;
    propositions: string[];
    targets: TargetResult[];
    summary: ReasoningSummary;
    availableFacts: string[];
    missingFacts: string[];
    skippedSteps: SkippedStep[];
    factResolutions: Record<string, boolean>;
    resolverErrors: ResolverError[];
    verboseInfo: VerboseInfo | null;
    system: SystemHandle;
}

/**
 * Returned when a resolver throws or rejects. The scenario run is cancelled —
 * the system observed an outage in its sensors and the agent should not act on
 * incomplete or unreliable data. Callers must check `aborted` before using
 * fields that only exist on a normal ReasoningResults.
 */
export interface AbortedResults {
    aborted: true;
    reason: 'resolver_error';
    resolverName: string;
    cause: string;
    scenarioPath: string;
}

/**
 * Type guard: true when the run was aborted (e.g. a resolver threw).
 */
export function isAbortedResults(
    results: ReasoningResults | AbortedResults
): results is AbortedResults;

/**
 * Thrown by `runFactResolvers` when a resolver fails. Surfaces through
 * `runGentzenReasoning` as an `AbortedResults` return value, not a thrown
 * error — callers handle abort uniformly with normal results.
 */
export class ScenarioAbortedError extends Error {
    resolverName: string;
    cause: unknown;
    constructor(resolverName: string, cause: unknown);
}

export function runGentzenReasoning(
    scenarioPath: string,
    options?: RunOptions
): Promise<ReasoningResults | AbortedResults>;

export interface DisplayOptions {
    verbose?: boolean;
    logger?: unknown;
}

export function displayResults(results: ReasoningResults, options?: DisplayOptions): void;

export interface DisplayStoryOptions {
    /** One-line caption shown beneath the scenario name. */
    description?: string;
    /** Logger to write to. Defaults to a fresh logger derived from config. */
    logger?: unknown;
    /** Show raw formula strings in derivation output. Default true. */
    showRawFormulas?: boolean;
}

/**
 * Print a narrative summary of a reasoning result.
 *
 * Five sections: header, propositions, facts, inference steps, target verdicts.
 * Use this for demos and operator-facing UIs. Use `displayResults` for the
 * flat diagnostic dump intended for debugging.
 */
export function displayStory(results: ReasoningResults, options?: DisplayStoryOptions): void;
