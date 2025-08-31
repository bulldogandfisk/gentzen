import fs from 'node:fs';
import yaml from 'yaml';
import { createLogger } from './utilities/logger.js';
import { getConfigSection } from './utilities/config.js';

// Simple validation function for scenarios.
// @param {string} scenarioPath - Path to YAML scenario file.
// @returns {Object} Validation results.
//
export function validateScenario(scenarioPath) {
    const errors = [];
    const warnings = [];
    
    try {
        const content = fs.readFileSync(scenarioPath, 'utf8');
        const scenario = yaml.parse(content);

        // 1. Check required fields.
        //
        if (!scenario.targets || !Array.isArray(scenario.targets) || scenario.targets.length === 0) {
            errors.push('Missing required "targets" field or targets array is empty');
        }
        
        // 2. Check targets are strings.
        //
        if (scenario.targets) {
            scenario.targets.forEach((target, i) => {
                if (!target || typeof target !== 'string') {
                    errors.push(`Target ${i} is not a valid string`);
                }
            });
        }
        
        // 3. Check steps format if present.
        //
        if (scenario.steps) {
            if (!Array.isArray(scenario.steps)) {
                errors.push('Steps must be an array');
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
        
        // 4. Check propositions format if present.
        //
        if (scenario.propositions) {
            if (!Array.isArray(scenario.propositions)) {
                errors.push('Propositions must be an array');
            } else {
                const names = new Set();
                scenario.propositions.forEach((prop, i) => {
                    if (typeof prop !== 'string') {
                        errors.push(`Proposition ${i} must be a string`);
                    } else {
                        if (names.has(prop)) {
                            errors.push(`Duplicate proposition name: ${prop}`);
                        }
                        names.add(prop);
                        
                        // Check naming convention
                        if (!/^[A-Z][a-zA-Z0-9]*$/.test(prop)) {
                            warnings.push(`Proposition "${prop}" should use PascalCase naming`);
                        }
                    }
                });
            }
        }
        
        // 5. Basic formula syntax checks.
        //
        const allFormulas = [];
        if (scenario.targets) allFormulas.push(...scenario.targets);
        if (scenario.steps) {
            scenario.steps.forEach(step => {
                if (step.from) allFormulas.push(...step.from);
            });
        }
        
        allFormulas.forEach((formula, i) => {
            if (typeof formula === 'string') {
                // Check for balanced parentheses.
                //
                let parenCount = 0;
                for (const char of formula) {
                    if (char === '(') parenCount++;
                    if (char === ')') parenCount--;
                    if (parenCount < 0) {
                        errors.push(`Formula "${formula}" has unbalanced parentheses`);
                        break;
                    }
                }
                if (parenCount !== 0) {
                    errors.push(`Formula "${formula}" has unbalanced parentheses`);
                }
                
                // Check for compound formulas without parentheses.
                //
                const hasOperators = /[∧∨→↔]|AND|OR|->|<->/.test(formula);
                const hasParens = formula.includes('(');
                if (hasOperators && !hasParens) {
                    warnings.push(`Formula "${formula}" may need parentheses around compound expressions`);
                }
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            summary: `${errors.length} errors, ${warnings.length} warnings`
        };
        
    } catch (error) {
        return {
            isValid: false,
            errors: [`Failed to parse scenario file: ${error.message}`],
            warnings: [],
            summary: 'File parsing failed'
        };
    }
}

// Validate and display results
// @param {string} scenarioPath - Path to scenario file
// @param {boolean} verbose - Show detailed output
//
export function validateAndDisplay(scenarioPath, verbose = false) {
    const logConfig = getConfigSection('logging');
    const logger = createLogger(logConfig);
    
    if (verbose) {
        logger.info(`🔍 Validating: ${scenarioPath}`);
    }
    
    const results = validateScenario(scenarioPath);
    
    if (results.errors.length > 0) {
        logger.error('❌ ERRORS:');
        results.errors.forEach(error => {
            logger.error(`  • ${error}`);
        });
    }
    
    if (results.warnings.length > 0) {
        logger.warn('⚠️  WARNINGS:');
        results.warnings.forEach(warning => {
            logger.warn(`  • ${warning}`);
        });
    }
    
    if (results.isValid) {
        logger.info('✅ Scenario validation passed');
    } else {
        logger.error('❌ Scenario validation failed');
    }
    
    if (verbose) {
        logger.debug(`Summary: ${results.summary}`);
    }
    
    return results;
}