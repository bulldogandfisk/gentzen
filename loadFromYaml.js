import { readFile } from 'node:fs/promises';
import YAML from 'yaml';
import { GentzenSystem } from './gentzen.js';
import { parseFormula } from './gentzen.js';
import { getAtoms } from './utilities/formulaAST.js';
import { createLogger } from './utilities/logger.js';
import { getConfigSection } from './utilities/config.js';
import { addFormulaAtomsToSet } from './utilities/formulaUtils.js';

// Collect all atomic propositions that are referenced (but don't validate)
function collectReferencedAtoms(scenario) {
    const referencedAtoms = new Set();

    // Collect from propositions
    if (scenario.propositions) {
        for(const p of scenario.propositions) {
            referencedAtoms.add(p);
        }
    }

    // Collect from steps using proper formula parsing
    if (scenario.steps) {
        for(const step of scenario.steps) {
            if (step.from && Array.isArray(step.from)) {
                for(const formula of step.from) {
                    addFormulaAtomsToSet(formula, referencedAtoms);
                }
            }
        }
    }

    // Collect from targets using proper formula parsing
    if (scenario.targets) {
        for(const target of scenario.targets) {
            addFormulaAtomsToSet(target, referencedAtoms);
        }
    }

    return referencedAtoms;
}

// Load a Gentzen scenario from YAML and build the proof system
export async function loadGentzenScenario(yamlPath, factResolvers = {}, options = {}) {
    // Create logger for this operation
    const logConfig = getConfigSection('logging');
    const logger = createLogger(logConfig);
    
    const fileContent = await readFile(yamlPath, 'utf8');
    const scenario = YAML.parse(fileContent);

    const referencedAtoms = collectReferencedAtoms(scenario);
    const system = new GentzenSystem(options);

    // Add dynamic facts from resolvers
    if (factResolvers && typeof factResolvers === 'object') {
        const factMap = await runFactResolvers(factResolvers);
        for (const [factName, isResolved] of Object.entries(factMap)) {
            if (isResolved) {
                system.addFact(factName);        // Add positive fact
            } else if (!factName.startsWith('~')) {
                system.addFact(`~${factName}`);  // Add negated fact for false resolvers
            }
        }
    }

    // Add propositions as potential derivation targets
    if (scenario.propositions) {
        for(const p of scenario.propositions) {
            system.addProposition(p);
        }
    }

    // Process steps with graceful handling of missing facts
    if (scenario.steps) {
        for(let index = 0; index < scenario.steps.length; index += 1) {
            const step = scenario.steps[index];
            const { rule, subtype, from } = step;
            if (!Array.isArray(from)) { continue; }

            // Check if all required facts are available
            const missingFacts = [];
            const stepObjects = [];
            
            for (const formula of from) {
                if ([...system.facts].includes(formula)) {
                    stepObjects.push({
                        origin: 'FactRef',
                        ruleType: 'factRef',
                        from: [],
                        formulas: new Set([formula])
                    });
                } else {
                    const foundSteps = system.findStepsContaining(formula);
                    if (foundSteps.length > 0) {
                        stepObjects.push(foundSteps[0]);
                    } else {
                        // Check if it's a missing atomic fact using proper formula resolution
                        const { canResolve, missing } = system.canResolveFormula(formula);
                        if (!canResolve) {
                            missingFacts.push(...missing);
                        } else {
                            // Formula structure issue, not just missing facts - expected in some test scenarios
                            logger.debug(`Step #${index + 1}: Cannot resolve formula "${formula}"`);
                        }
                    }
                }
            }

            // If we have missing facts, track them and skip this step
            if (missingFacts.length > 0) {
                system.skippedSteps.push({
                    stepIndex: index + 1,
                    rule,
                    subtype,
                    from,
                    missingFacts
                });
                missingFacts.forEach(fact => system.trackMissingFact(fact));
                continue;
            }

            // Only proceed if we have all required step objects
            if (stepObjects.length !== from.length) {
                continue;
            }

            // Apply the rule
            let newStep = null;
            try {
                switch (rule) {
                    case 'alpha': {
                        if (stepObjects.length === 2) {
                            newStep = system.alphaRule(
                                stepObjects[0],
                                stepObjects[1],
                                subtype || 'and'
                            );
                        }
                        break;
                    }
                    case 'beta': {
                        if (stepObjects.length === 2) {
                            newStep = system.betaRule(stepObjects[0], stepObjects[1]);
                        }
                        break;
                    }
                    case 'contraposition': {
                        if (stepObjects.length === 1) {
                            newStep = system.contrapositionRule(stepObjects[0]);
                        }
                        break;
                    }
                    case 'doubleNegation': {
                        if (stepObjects.length === 1) {
                            newStep = system.doubleNegationRule(
                                stepObjects[0],
                                subtype || 'introduction'
                            );
                        }
                        break;
                    }
                    case 'equivalence': {
                        if (stepObjects.length === 2) {
                            newStep = system.equivalenceRule(
                                stepObjects[0],
                                stepObjects[1]
                            );
                        }
                        break;
                    }
                    default: {
                        logger.warn(`Unknown rule "${rule}" in Step #${index + 1}. Skipping.`);
                        continue;
                    }
                }
            } catch (error) {
                logger.warn(`Step #${index + 1} failed to apply rule "${rule}": ${error.message}`);
                continue;
            }
        }
    }

    const targets = scenario.targets || [];
    return { system, targets, referencedAtoms, propositions: scenario.propositions || [] };
}

// Helper function to run fact resolvers and return a fact map
export async function runFactResolvers(factResolvers) {
    // Create logger for this operation
    const logConfig = getConfigSection('logging');
    const logger = createLogger(logConfig);
    
    const factMap = {};
    
    for (const [factName, resolver] of Object.entries(factResolvers)) {
        try {
            if (typeof resolver === 'function') {
                const result = resolver();
                // Handle async functions by properly awaiting them
                if (result instanceof Promise) {
                    try {
                        const awaitedResult = await result;
                        factMap[factName] = Boolean(awaitedResult);
                    } catch (error) {
                        logger.warn(`Fact resolver for "${factName}" failed: ${error.message}`);
                        factMap[factName] = false;
                    }
                } else {
                    factMap[factName] = Boolean(result);
                }
            } else {
                factMap[factName] = Boolean(resolver);
            }
        } catch (error) {
            logger.warn(`Fact resolver for "${factName}" failed: ${error.message}`);
            factMap[factName] = false;
        }
    }
    
    return factMap;
}

// Create a scenario template without hardcoded facts
export function createScenarioTemplate(scenario) {
    const template = { ...scenario };
    delete template.facts; // Remove hardcoded facts
    return template;
}
