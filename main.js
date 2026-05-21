import { EOL } from 'node:os';
import fs from 'fs-extra';
import YAML from 'yaml';
import { loadGentzenScenario, runFactResolvers, collectReferencedAtoms, ScenarioAbortedError } from './loadFromYaml.js';
import { discoverResolvers } from './resolverDiscovery.js';
import { validateScenario } from './validator.js';
import { createLogger, LogLevel } from './utilities/logger.js';
import { getConfigSection } from './utilities/config.js';
import { normalizeFormula } from './utilities/formulaUtils.js';
import chalk from 'chalk';

// Read the scenario YAML and return the set of atoms it references.
async function extractReferencedAtomsFromScenario(scenarioPath) {
    const fileContent = await fs.readFile(scenarioPath, 'utf8');
    const scenario = YAML.parse(fileContent);
    if (!scenario || typeof scenario !== 'object') {
        throw new Error(`Scenario file "${scenarioPath}" is empty or does not contain a valid YAML object`);
    }
    return collectReferencedAtoms(scenario);
}

// Validate the scenario and log any errors or warnings.
async function handleScenarioValidation(scenarioPath, options = {}) {
    const { verbose = false, logger } = options;

    if (verbose) {
        logger.info('🔍 Validating scenario...');
    }

    const validation = await validateScenario(scenarioPath);

    if (!validation.isValid) {
        logger.warn('⚠️  Scenario validation found issues:');
        validation.errors.forEach(error => {
            logger.warn(`  • ${error}`);
        });
        if (verbose && validation.warnings.length > 0) {
            validation.warnings.forEach(warning => {
                logger.warn(`  • ${warning}`);
            });
        }
    } else if (verbose) {
        logger.info('✅ Scenario validation passed');
    }

    return validation;
}

// Discover resolvers from disk, merge with caller-supplied resolvers (caller wins),
// optionally filter discovered resolvers to required atoms, run them all,
// return the resulting factMap. Caller-supplied resolvers always run.
//
async function handleResolverDiscovery(resolversPath, customResolvers = {}, requiredAtoms = null, logger = null) {
    let discoveredResolvers = {};
    let loadedFiles = [];
    let totalResolvers = 0;
    let resolverErrors = [];

    if (resolversPath) {
        const discovery = await discoverResolvers(resolversPath);
        discoveredResolvers = discovery.resolvers;
        loadedFiles = discovery.loadedFiles;
        totalResolvers = discovery.totalResolvers;
        resolverErrors = discovery.errors || [];
        if (logger && resolverErrors.length > 0) {
            for (const err of resolverErrors) {
                logger.warn(`Resolver file "${err.file}" failed to load: ${err.error}`);
            }
        }
    }

    const filteredDiscovered = requiredAtoms ?
        Object.fromEntries(
            Object.entries(discoveredResolvers).filter(([name]) => requiredAtoms.has(name))
        ) : discoveredResolvers;

    // Caller-supplied resolvers override discovered ones of the same name and are never filtered.
    const allResolvers = { ...filteredDiscovered, ...customResolvers };

    const factMap = await runFactResolvers(allResolvers);

    return {
        allResolvers,
        factMap,
        loadedFiles,
        totalResolvers,
        resolverErrors
    };
}

// Build the initial results object before target evaluation.
function buildInitialResults(scenarioPath, system, targets, factMap, loadedFiles, totalResolvers, verboseInfo, propositions = [], resolverErrors = []) {
    return {
        scenarioPath,
        propositions,
        targets: [],
        summary: {
            totalTargets: targets.length,
            provenTargets: 0,
            assertedTargets: 0,
            availableFacts: system.facts.size,
            missingFacts: system.missingFacts.size,
            skippedSteps: system.skippedSteps.length,
            loadedFiles: loadedFiles,
            totalResolvers: totalResolvers
        },
        availableFacts: Array.from(system.facts),
        missingFacts: Array.from(system.missingFacts),
        skippedSteps: system.skippedSteps,
        factResolutions: factMap,
        resolverErrors,
        verboseInfo,
        system
    };
}

// Evaluate every declared target and write outcomes onto results.targets.
// If `onProof` is provided, invoke it once per target with timing info.
//
async function evaluateTargets(targets, system, results, { onProof, logger } = {}) {
    for (const target of targets) {
        const startedAt = performance.now();
        const result = system.searchForProof(target);
        const durationMs = performance.now() - startedAt;

        if (result.proven) {
            results.summary.provenTargets++;
            if (result.derivation === 'asserted') {
                results.summary.assertedTargets++;
            }
        }
        results.targets.push({
            formula: target,
            proven: result.proven,
            derivation: result.derivation,
            missingFacts: result.missingFacts,
            path: result.path
        });

        if (onProof) {
            try {
                await onProof({
                    target,
                    proven: result.proven,
                    derivation: result.derivation,
                    path: result.path,
                    missingFacts: result.missingFacts,
                    durationMs
                });
            } catch (callbackErr) {
                if (logger) {
                    logger.warn(`onProof callback threw for "${target}": ${callbackErr.message}`);
                }
            }
        }
    }
    return results;
}

// Run reasoning for a YAML scenario file.
// @param {string} scenarioPath - Absolute path to the scenario YAML.
// @param {Object} [options]
// @param {boolean} [options.verbose=false] - Emit progress and detail logs.
// @param {Object<string, function|*>} [options.customResolvers] - Resolvers that override
//     same-named discovered resolvers. Functions are called; non-functions are coerced to boolean.
// @param {string} [options.resolversPath] - Directory to scan for resolver JS files.
// @param {boolean} [options.validate=true] - Validate the scenario before running.
// @param {boolean} [options.selectiveResolution=true] - Only run resolvers whose atom names
//     are referenced by the scenario.
// @param {function} [options.onProof] - Called once per target with
//     {target, proven, path, missingFacts, durationMs}. May be async.
// @returns {Promise<Object>} The results object (see docs/api-reference.md).
//
export async function runGentzenReasoning(scenarioPath, options = {}) {
    const {
        verbose = false,
        customResolvers = {},
        resolversPath,
        validate = true,
        selectiveResolution = true,
        onProof
    } = options;

    const logConfig = getConfigSection('logging');
    const logger = createLogger(logConfig);

    try {
        if (validate) {
            await handleScenarioValidation(scenarioPath, { verbose, logger });
        }

        let requiredAtoms = null;
        if (selectiveResolution && resolversPath) {
            try {
                requiredAtoms = await extractReferencedAtomsFromScenario(scenarioPath);
                if (verbose) {
                    logger.info(`🎯 Selective resolution: ${requiredAtoms.size} atoms required`);
                }
            } catch (error) {
                logger.warn(`Failed to extract atoms for selective resolution: ${error.message}`);
            }
        }

        const { allResolvers, factMap, loadedFiles, totalResolvers, resolverErrors } = await handleResolverDiscovery(resolversPath, customResolvers, requiredAtoms, logger);

        const verboseInfo = verbose ? {
            loadedFiles: loadedFiles.map(f => f.replace(process.cwd(), '.')),
            factResolutionDetails: factMap,
            resolversPath
        } : null;

        const { system, targets, propositions } = await loadGentzenScenario(scenarioPath, factMap);
        const results = buildInitialResults(scenarioPath, system, targets, factMap, loadedFiles, totalResolvers, verboseInfo, propositions, resolverErrors);

        await evaluateTargets(targets, system, results, { onProof, logger });

        return results;

    } catch (error) {
        if (error instanceof ScenarioAbortedError) {
            logger.error(`❌ Scenario aborted: resolver "${error.resolverName}" failed — ${error.cause?.message ?? String(error.cause)}`);
            return {
                aborted: true,
                reason: 'resolver_error',
                resolverName: error.resolverName,
                cause: error.cause?.message ?? String(error.cause),
                scenarioPath
            };
        }
        logger.error(`❌ Error running Gentzen reasoning: ${error.message}`);
        throw error;
    }
}

// True if the result is an aborted-scenario sentinel rather than a normal
// reasoning result. Callers gating side effects should check this first.
//
export function isAbortedResults(results) {
    return Boolean(results && results.aborted === true);
}

// Re-export for callers that want to distinguish abort from other errors.
//
export { ScenarioAbortedError };

export function displayResults(results, options = {}) {
    const { verbose = false } = options;
    const logConfig = getConfigSection('logging');
    const logger = options.logger || createLogger(logConfig);

    if (isAbortedResults(results)) {
        const scenarioName = (results.scenarioPath || '').split('/').pop() || '(unknown)';
        logger.info(`${EOL}${chalk.bold(`📁 Scenario: ${scenarioName}`)}`);
        logger.error(`${EOL}${chalk.red.bold('⛔ SCENARIO ABORTED')}`);
        logger.error(`  Reason: ${results.reason}`);
        logger.error(`  Resolver: ${results.resolverName}`);
        logger.error(`  Cause: ${results.cause}`);
        return;
    }

    const { system, verboseInfo, scenarioPath, propositions } = results;

    const scenarioName = scenarioPath.split('/').pop();
    logger.info(`${EOL}${chalk.bold(`📁 Scenario: ${scenarioName}`)}`);

    if (propositions && propositions.length > 0) {
        logger.info(`${EOL}${chalk.bold('📋 Propositions:')}`);
        for (const proposition of propositions) {
            logger.info(`  ${chalk.blue('•')} ${proposition}`);
        }
    }

    if (verbose && verboseInfo) {
        const resolverFiles = verboseInfo.loadedFiles.join(`, `);
        logger.info(`${EOL}🔧 Loaded resolver files: ${resolverFiles}`);
        logger.info(`${EOL}🔍 Fact Resolvers:`);
        for (const [fact, resolved] of Object.entries(verboseInfo.factResolutionDetails)) {
            const status = resolved ? '✅' : '❌';
            logger.info(`  ${status} ${fact}`);
        }
    }

    logger.info(`${EOL}${chalk.bold('Available Facts:')}`);
    for (const fact of results.availableFacts) {
        logger.info(`  ${chalk.green('✓')} ${fact}`);
    }

    if (results.missingFacts.length > 0) {
        logger.info(`${EOL}${chalk.bold('Missing Facts:')}`);
        for (const fact of results.missingFacts) {
            logger.info(`  ${chalk.red('✗')} ${fact}`);
        }
    }

    if (results.resolverErrors && results.resolverErrors.length > 0) {
        logger.warn(`${EOL}${chalk.bold('⚠️  Resolver Errors:')}`);
        for (const err of results.resolverErrors) {
            logger.warn(`  ${chalk.red('✗')} ${err.file}: ${err.error}`);
        }
    }

    const provenTargets = results.targets.filter(t => t.proven);
    const assertedTargets = provenTargets.filter(t => t.derivation === 'asserted');
    const inferredTargets = provenTargets.filter(t => t.derivation === 'inference' || t.derivation === 'derived' || t.derivation === 'fact');
    const failedTargets = results.targets.filter(t => !t.proven);
    logger.info(`${EOL}${chalk.bold(`Target Results: ${inferredTargets.length} proven, ${assertedTargets.length} assumed, ${failedTargets.length} failed`)}`);
    for (const target of results.targets) {
        if (target.proven) {
            if (target.derivation === 'asserted') {
                logger.info(`  ${chalk.yellow('⚠ ASSUMED:')} ${target.formula} ${chalk.gray('(declared as proposition; not derived)')}`);
            } else if (target.derivation === 'fact') {
                logger.info(`  ${chalk.green('✅ PROVEN:')} ${target.formula} ${chalk.gray('(matches a resolved fact)')}`);
            } else {
                logger.info(`  ${chalk.green('✅ PROVEN:')} ${target.formula}`);
                if (target.path && target.path.length > 0) {
                    logger.info(`     ${chalk.gray(`Derivation (${target.path.length} step${target.path.length === 1 ? '' : 's'}):`)}`);
                    for (let i = 0; i < target.path.length; i += 1) {
                        const entry = target.path[i];
                        const premStr = entry.premises.join(', ');
                        logger.info(`     ${chalk.gray(`  [${i + 1}]`)} ${chalk.cyan(entry.rule)}(${premStr}) ${chalk.gray('→')} ${entry.conclusion}`);
                    }
                }
            }
        } else {
            logger.info(`  ${chalk.red('❌ FAILED:')} ${target.formula}`);
            if (target.missingFacts.length > 0) {
                logger.info(`     ${chalk.yellow('Missing:')} ${target.missingFacts.join(', ')}`);
            }
        }
    }

    if (verbose && system) {
        logger.info(`${EOL}${chalk.bold('=== PROOF STEPS ===')}`);
        for (let i = 0; i < system.steps.length; i += 1) {
            const step = system.steps[i];
            const formula = [...step.formulas][0];
            const fromIndices = step.from
                .map(s => system.steps.indexOf(s) + 1)
                .join(', ') || '-';
            logger.info(`${chalk.blue(`Step #${i + 1}:`)} ${step.origin} [${step.ruleType}]`);
            logger.info(`  from: ${fromIndices}`);
            logger.info(`  formula: ${chalk.green(formula)}`);
            logger.info('---');
        }
        if (verboseInfo?.resolversPath) {
            logger.info(`${EOL}🔧 Loaded from: ${verboseInfo.resolversPath}`);
        }
    }

    if (results.skippedSteps.length > 0) {
        logger.info(`${EOL}${chalk.bold('⏸️ Skipped Steps:')}`);
        results.skippedSteps.forEach((step, i) => {
            logger.info(`${i + 1}. Step ${step.stepIndex} (${step.rule}): Missing ${step.missingFacts.join(', ')}`);
        });
    }

    logger.info(`${EOL}${chalk.bold('🔍 Fact Resolutions:')}`);
    Object.entries(results.factResolutions).forEach(([fact, resolved]) => {
        const status = resolved ? '✅' : '❌';
        logger.info(`  ${status} ${fact}`);
    });
}

// Human-friendly label for a derived step.
//
function ruleLabel(step) {
    switch (step.origin) {
        case 'AlphaRule':
            return 'alpha-AND';
        case 'BetaRule':
            return 'beta-OR';
        case 'ContrapositionRule':
            return 'contraposition';
        case 'DoubleNegationRule':
            return step.ruleType === 'doubleNegElim' ? 'doubleNeg-elim' : 'doubleNeg-intro';
        case 'ModusPonensRule':
            return 'modus-ponens';
        case 'ModusTollensRule':
            return 'modus-tollens';
        case 'DisjunctiveModusPonensRule':
            return 'disj-MP';
        case 'DisjunctiveSyllogismRule':
            return 'disj-syll';
        case 'AndEliminationRule':
            return step.ruleType === 'andElimR' ? 'andElim-R' : 'andElim-L';
        case 'OrEliminationRule':
            return 'orElim';
        case 'Fact':
            return 'fact';
        default:
            return step.origin;
    }
}

// Print a narrative summary of a reasoning result.
//   Scenario header, propositions, facts, inference steps, target verdicts.
//
// @param {Object} results - Result object from runGentzenReasoning.
// @param {Object} [options]
// @param {string} [options.description] - One-line caption shown under the scenario name.
// @param {Logger} [options.logger] - Logger to write to. Defaults to a fresh logger.
// @param {boolean} [options.showRawFormulas=true] - Show raw formula strings in derivation output.
//
export function displayStory(results, options = {}) {
    const { description } = options;
    // Default to a clean logger: no timestamps, no level labels, always shows INFO.
    // Callers who want their own routing pass options.logger.
    //
    const logger = options.logger || createLogger({
        level: LogLevel.INFO,
        enableTimestamps: false,
        enableLabels: false
    });

    if (isAbortedResults(results)) {
        const scenarioName = results.scenarioPath ? results.scenarioPath.split('/').pop() : '(no scenario)';
        const bar = chalk.gray('━'.repeat(60));
        logger.info(`${EOL}${bar}`);
        logger.info(`  ${chalk.bold('Scenario:')} ${scenarioName}`);
        if (description) {
            logger.info(`  ${chalk.gray(description)}`);
        }
        logger.info(bar);
        logger.info(`${EOL}${chalk.red.bold('⛔ SCENARIO ABORTED')}`);
        logger.info(`  ${chalk.red('Reason:')}   ${results.reason}`);
        logger.info(`  ${chalk.red('Resolver:')} ${results.resolverName}`);
        logger.info(`  ${chalk.red('Cause:')}    ${results.cause}${EOL}`);
        return;
    }

    const {
        system,
        scenarioPath,
        propositions,
        targets,
        factResolutions,
        skippedSteps,
        resolverErrors
    } = results;

    const scenarioName = scenarioPath ? scenarioPath.split('/').pop() : '(no scenario)';
    const bar = chalk.gray('━'.repeat(60));

    // Header
    logger.info(`${EOL}${bar}`);
    logger.info(`  ${chalk.bold('Scenario:')} ${scenarioName}`);
    if (description) {
        logger.info(`  ${chalk.gray(description)}`);
    }
    logger.info(bar);

    // Propositions
    logger.info(`${EOL}${chalk.bold('Propositions')}`);
    if (propositions && propositions.length > 0) {
        for (const p of propositions) {
            logger.info(`  ${chalk.blue('•')} ${p}`);
        }
    } else {
        logger.info(`  ${chalk.gray('(none declared)')}`);
    }

    // Facts
    logger.info(`${EOL}${chalk.bold('Facts')}`);
    const factEntries = Object.entries(factResolutions || {});
    if (factEntries.length === 0) {
        logger.info(`  ${chalk.gray('(no resolvers ran)')}`);
    } else {
        for (const [name, resolved] of factEntries) {
            if (resolved) {
                logger.info(`  ${chalk.green('✓')} ${name}`);
            } else {
                logger.info(`  ${chalk.yellow('✗')} ${name} ${chalk.gray(`→ added as ~${name}`)}`);
            }
        }
    }

    // Resolver errors, if any (caller cares about these in the same section).
    if (resolverErrors && resolverErrors.length > 0) {
        logger.info(`${EOL}${chalk.bold('Resolver errors')}`);
        for (const err of resolverErrors) {
            logger.info(`  ${chalk.red('!')} ${err.file}: ${err.error}`);
        }
    }

    // Inference steps (excludes proposition steps).
    const formatFromRef = (fromStep) => {
        const formula = [...fromStep.formulas][0] || '?';
        const idx = system.steps.indexOf(fromStep);
        if (idx >= 0) {
            return `step #${idx + 1} (${formula})`;
        }
        // FactRef or external — print formula directly.
        return formula;
    };

    const derivedSteps = (system?.steps || []).filter(s => s.ruleType !== 'fact');
    logger.info(`${EOL}${chalk.bold('Inference steps')}`);
    if (derivedSteps.length === 0) {
        logger.info(`  ${chalk.gray('(no derivations)')}`);
    } else {
        for (const step of derivedSteps) {
            const idx = system.steps.indexOf(step);
            const label = ruleLabel(step);
            const inputs = step.from.map(formatFromRef).join(', ');
            const derived = [...step.formulas][0];
            logger.info(`  ${chalk.blue(`[${idx + 1}]`)} ${chalk.cyan(label.padEnd(16))} ${chalk.gray(inputs)}`);
            logger.info(`       ${chalk.gray('→')} ${chalk.green(derived)}`);
        }
    }

    // Targets
    logger.info(`${EOL}${chalk.bold('Targets')}`);
    if (!targets || targets.length === 0) {
        logger.info(`  ${chalk.gray('(none declared)')}`);
    } else {
        for (const target of targets) {
            if (target.proven) {
                const source = derivationLabel(target, system, results.availableFacts || []);
                if (target.derivation === 'asserted') {
                    logger.info(`  ${chalk.yellow('⚠ ASSUMED ')} ${target.formula}`);
                } else {
                    logger.info(`  ${chalk.green('✅ PROVEN ')} ${target.formula}`);
                }
                logger.info(`             ${chalk.gray(source)}`);
                // For inferred / derived targets, render the actual chain so
                // consumers can see WHY the target was proven.
                //
                if (Array.isArray(target.path) && target.path.length > 0) {
                    for (let i = 0; i < target.path.length; i += 1) {
                        const entry = target.path[i];
                        const premStr = entry.premises.join(', ');
                        logger.info(`             ${chalk.gray(`[${i + 1}]`)} ${chalk.cyan(entry.rule)}(${premStr}) ${chalk.gray('→')} ${entry.conclusion}`);
                    }
                }
            } else {
                logger.info(`  ${chalk.red('❌ FAILED ')} ${target.formula}`);
                if (target.missingFacts && target.missingFacts.length > 0) {
                    logger.info(`             ${chalk.yellow('missing facts:')} ${target.missingFacts.join(', ')}`);
                }
            }
        }
    }

    // Skipped steps (separate section so failed targets and their causes
    // are both visible even when there is no missingFacts overlap).
    //
    if (skippedSteps && skippedSteps.length > 0) {
        logger.info(`${EOL}${chalk.bold('Skipped steps')}`);
        for (const skip of skippedSteps) {
            const reasonLabel = skip.reason || 'missing_fact';
            const fromText = Array.isArray(skip.from) ? skip.from.join(', ') : '';
            logger.info(`  ${chalk.yellow('⏸')} step #${skip.stepIndex} (${skip.rule}): ${reasonLabel}`);
            if (fromText) {
                logger.info(`     ${chalk.gray(`from: ${fromText}`)}`);
            }
            if (skip.missingFacts && skip.missingFacts.length > 0) {
                logger.info(`     ${chalk.gray('missing atoms:')} ${skip.missingFacts.join(', ')}`);
            }
        }
    }

    // Tally
    const provenCount = targets ? targets.filter(t => t.proven).length : 0;
    const assertedCount = targets ? targets.filter(t => t.proven && t.derivation === 'asserted').length : 0;
    const inferredCount = provenCount - assertedCount;
    const totalCount = targets ? targets.length : 0;
    const color = provenCount === totalCount ? chalk.green : (provenCount === 0 ? chalk.red : chalk.yellow);
    const breakdown = assertedCount > 0
        ? `${inferredCount} proven, ${assertedCount} assumed, ${totalCount - provenCount} failed`
        : `${provenCount}/${totalCount} targets proven`;
    logger.info(`${EOL}${chalk.bold('Result:')} ${color(breakdown)}${EOL}`);
}

// Human-readable label for the engine-provided `derivation` classification.
// Prefers the structured derivation field over re-deriving from the system.
//
function derivationLabel(target, system, availableFacts) {
    if (target.derivation === 'fact') {
        return 'matches a resolved fact';
    }
    if (target.derivation === 'asserted') {
        return 'declared as proposition (not derived)';
    }
    if (target.derivation === 'inference') {
        const depth = target.path?.length || 0;
        return depth > 0
            ? `via proof search (${depth} step${depth === 1 ? '' : 's'})`
            : 'via proof search';
    }
    if (target.derivation === 'derived' && system && Array.isArray(system.steps)) {
        let normalizedTarget;
        try {
            normalizedTarget = normalizeFormula(target.formula);
        } catch {
            return 'derived during YAML step execution';
        }
        for (let i = 0; i < system.steps.length; i += 1) {
            const step = system.steps[i];
            for (const f of step.formulas) {
                try {
                    if (normalizeFormula(f) === normalizedTarget) {
                        return `derived at step #${i + 1}`;
                    }
                } catch {
                    // Skip malformed entries.
                }
            }
        }
        return 'derived during YAML step execution';
    }
    return 'matched directly';
}
