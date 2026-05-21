import fs from 'fs-extra';
import yaml from 'yaml';
import { validateFormulaSyntax } from './utilities/formulaParser.js';

// Validate a scenario file.
// @param {string} scenarioPath - Path to YAML scenario file.
// @returns {Promise<{isValid: boolean, errors: string[], warnings: string[], summary: string}>}
//
export async function validateScenario(scenarioPath) {
    const errors = [];
    const warnings = [];

    let scenario;
    try {
        const content = await fs.readFile(scenarioPath, 'utf8');
        scenario = yaml.parse(content);
    } catch (error) {
        return {
            isValid: false,
            errors: [`Failed to parse scenario file: ${error.message}`],
            warnings: [],
            summary: 'File parsing failed'
        };
    }

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
