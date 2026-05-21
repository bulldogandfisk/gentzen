// Type declarations for `gentzen/validator`.

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    summary: string;
}

export function validateScenario(scenarioPath: string): Promise<ValidationResult>;
