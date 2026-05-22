import fs from 'fs-extra';
import yaml from 'yaml';
import { validateFormulaSyntax } from './utilities/formulaParser.js';

// Read and parse a scenario YAML file. Throws if the file can't be read
// or the YAML is invalid. Separate from validateScenario so callers can
// parse once and validate, extract atoms, and build a system off the same
// parsed object.
//
export async function readScenarioFile(scenarioPath) {
    const content = await fs.readFile(scenarioPath, 'utf8');
    const scenario = yaml.parse(content);
    if (!scenario || typeof scenario !== 'object') {
        throw new Error(`Scenario file "${scenarioPath}" is empty or does not contain a valid YAML object`);
    }
    return scenario;
}

// Validate a parsed scenario object. Returns { isValid, errors, warnings,
// summary }. `options.source` is an optional label (typically the file
// path) prepended to error messages where useful — omit for pure object
// inputs.
//
export function validateScenario(scenario, options = {}) {
    const errors = [];
    const warnings = [];

    if (!scenario || typeof scenario !== 'object') {
        return {
            isValid: false,
            errors: ['Scenario is empty or not a YAML object'],
            warnings: [],
            summary: '1 errors, 0 warnings'
        };
    }

    if (!scenario.targets || !Array.isArray(scenario.targets) || scenario.targets.length === 0) {
        errors.push(`Missing required "targets" field or targets array is empty`);
    }

    if (scenario.targets) {
        scenario.targets.forEach((target, i) => {
            if (!target || typeof target !== 'string') {
                errors.push(`Target ${i} is not a valid string`);
            }
        });
    }

    if (scenario.steps) {
        if (!Array.isArray(scenario.steps)) {
            errors.push(`Steps must be an array`);
        } else {
            scenario.steps.forEach((step, i) => {
                if (!step.rule) {
                    errors.push(`Step ${i} missing "rule" field`);
                }
                if (!step.from || !Array.isArray(step.from)) {
                    errors.push(`Step ${i} missing "from" array`);
                }
            });
        }
    }

    if (scenario.propositions) {
        if (!Array.isArray(scenario.propositions)) {
            errors.push(`Propositions must be an array`);
        } else {
            const names = new Set();
            scenario.propositions.forEach((prop, i) => {
                if (typeof prop !== 'string') {
                    errors.push(`Proposition ${i} must be a string`);
                    return;
                }
                if (names.has(prop)) {
                    errors.push(`Duplicate proposition name: ${prop}`);
                }
                names.add(prop);
                if (!/^[A-Z][a-zA-Z0-9]*$/.test(prop)) {
                    warnings.push(`Proposition "${prop}" should use PascalCase naming`);
                }
            });
        }
    }

    // Parse every referenced formula. Anything the parser rejects is a hard error.
    const formulasToParse = [];
    if (Array.isArray(scenario.targets)) {
        scenario.targets.forEach((target, i) => {
            if (typeof target === 'string') {
                formulasToParse.push({ formula: target, source: `target ${i}` });
            }
        });
    }
    if (Array.isArray(scenario.steps)) {
        scenario.steps.forEach((step, i) => {
            if (Array.isArray(step.from)) {
                step.from.forEach((formula, j) => {
                    if (typeof formula === 'string') {
                        formulasToParse.push({ formula, source: `step ${i} from[${j}]` });
                    }
                });
            }
        });
    }

    for (const { formula, source } of formulasToParse) {
        const result = validateFormulaSyntax(formula);
        if (!result.isValid) {
            errors.push(`Formula "${formula}" (${source}) is not valid: ${result.errors[0]}`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        summary: `${errors.length} errors, ${warnings.length} warnings`
    };
}
