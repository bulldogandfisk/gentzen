import { GentzenSystem } from './gentzen.js';
import { createLogger } from './utilities/logger.js';
import { getConfigSection } from './utilities/config.js';
import { addFormulaAtomsToSet } from './utilities/formulaUtils.js';

// Thrown when a resolver fails (sync throw or rejected Promise). Cancels the
// whole scenario run. The system observed an outage in its sensors; the agent
// should not act on incomplete or unreliable data.
//
export class ScenarioAbortedError extends Error {
    constructor(resolverName, cause) {
        const causeMessage = cause?.message ?? String(cause);
        super(`Scenario aborted: resolver "${resolverName}" failed — ${causeMessage}`);
        this.name = 'ScenarioAbortedError';
        this.resolverName = resolverName;
        this.cause = cause;
    }
}

// Collect all atomic propositions that are referenced (but don't validate).
// Propositions, step `from` formulas, and targets may all be compound formulas;
// each is parsed and its atoms (with leading negations stripped) are collected.
//
export function collectReferencedAtoms(scenario) {
    const referencedAtoms = new Set();

    if (scenario.propositions) {
        for(const p of scenario.propositions) {
            addFormulaAtomsToSet(p, referencedAtoms);
        }
    }

    if (scenario.steps) {
        for(const step of scenario.steps) {
            if (step.from && Array.isArray(step.from)) {
                for(const formula of step.from) {
                    addFormulaAtomsToSet(formula, referencedAtoms);
                }
            }
        }
    }

    if (scenario.targets) {
        for(const target of scenario.targets) {
            addFormulaAtomsToSet(target, referencedAtoms);
        }
    }

    return referencedAtoms;
}

// Build a GentzenSystem from a parsed scenario object.
// @param {Object} scenario - Parsed scenario (use readScenarioFile to load).
// @param {Object} factMap - Pre-resolved fact map (name → boolean), as returned by runFactResolvers()
// @returns {{system, targets, referencedAtoms, propositions}}
//
export function buildGentzenSystem(scenario, factMap = {}, options = {}) {
    const logConfig = getConfigSection('logging');
    const logger = createLogger(logConfig);

    if (!scenario || typeof scenario !== 'object') {
        throw new Error('buildGentzenSystem requires a parsed scenario object');
    }

    const referencedAtoms = collectReferencedAtoms(scenario);
    const system = new GentzenSystem(options);

    // Populate system facts from pre-resolved fact map
    if (factMap && typeof factMap === 'object') {
        for (const [factName, isResolved] of Object.entries(factMap)) {
            if (isResolved) {
                system.addFact(factName);
            } else if (!factName.startsWith('~')) {
                system.addFact(`~${factName}`);
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

            const skipReasons = [];
            const missingFacts = [];
            const stepObjects = [];

            for (const formula of from) {
                if (system.facts.has(formula)) {
                    stepObjects.push({
                        origin: 'FactRef',
                        ruleType: 'factRef',
                        from: [],
                        formulas: new Set([formula])
                    });
                    continue;
                }

                const foundSteps = system.findStepsContaining(formula);
                if (foundSteps.length > 0) {
                    stepObjects.push(foundSteps[0]);
                    continue;
                }

                let resolution;
                try {
                    resolution = system.canResolveFormula(formula);
                } catch (parseErr) {
                    skipReasons.push('parse_error');
                    logger.debug(`Step #${index + 1}: parse error on "${formula}": ${parseErr.message}`);
                    continue;
                }

                if (!resolution.canResolve) {
                    missingFacts.push(...resolution.missing);
                    skipReasons.push('missing_fact');
                } else {
                    skipReasons.push('unknown_atom');
                    logger.debug(`Step #${index + 1}: formula "${formula}" has no matching fact or step`);
                }
            }

            if (skipReasons.length > 0 || stepObjects.length !== from.length) {
                const reason = skipReasons.includes('parse_error') ? 'parse_error'
                    : skipReasons.includes('unknown_atom') ? 'unknown_atom'
                    : 'missing_fact';
                system.skippedSteps.push({
                    stepIndex: index + 1,
                    rule,
                    subtype,
                    from,
                    missingFacts,
                    reason
                });
                missingFacts.forEach(fact => system.trackMissingFact(fact));
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
                    case 'modusPonens': {
                        if (stepObjects.length === 2) {
                            newStep = system.modusPonensRule(
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

// Run fact resolvers and return a fact map.
//
// Contract:
//   - A resolver that throws (sync) or returns a rejected Promise raises
//     ScenarioAbortedError. The scenario run is cancelled; the caller is
//     responsible for propagating that to the agent.
//   - Falsy return values (false, 0, '', null, undefined, NaN) are treated as
//     the resolver's "no" answer. Resolver authors own the distinction
//     between intentional false and missing data inside their resolver.
//   - Truthy values are coerced to true.
//
export async function runFactResolvers(factResolvers) {
    const factMap = {};

    for (const [factName, resolver] of Object.entries(factResolvers)) {
        if (typeof resolver === 'function') {
            let result;
            try {
                result = resolver();
            } catch (error) {
                throw new ScenarioAbortedError(factName, error);
            }
            if (result instanceof Promise) {
                let awaited;
                try {
                    awaited = await result;
                } catch (error) {
                    throw new ScenarioAbortedError(factName, error);
                }
                factMap[factName] = Boolean(awaited);
            } else {
                factMap[factName] = Boolean(result);
            }
        } else {
            factMap[factName] = Boolean(resolver);
        }
    }

    return factMap;
}

