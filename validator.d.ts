// Type declarations for `gentzen/validator`.

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    summary: string;
}

export interface ValidateOptions {
    /** Optional label (typically the source file path) for error messages. */
    source?: string;
}

/** Read and YAML-parse a scenario file. Throws on read or parse errors. */
export function readScenarioFile(scenarioPath: string): Promise<unknown>;

/** Validate a parsed scenario object. */
export function validateScenario(scenario: unknown, options?: ValidateOptions): ValidationResult;
