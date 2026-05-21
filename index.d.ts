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

export interface ProofEvent {
    target: string;
    proven: boolean;
    path: string[];
    missingFacts: string[];
    durationMs: number;
}

export type OnProofCallback = (event: ProofEvent) => void | Promise<void>;

export type ResolverFn = () => boolean | Promise<boolean>;

export interface TargetResult {
    formula: string;
    proven: boolean;
    missingFacts: string[];
    path: string[];
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
    provenTargets: number;
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

export function runGentzenReasoning(
    scenarioPath: string,
    options?: RunOptions
): Promise<ReasoningResults>;

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
    /** Reserved for a future mnemonic-formula display mode. Default true. */
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
