import { EOL } from 'node:os';
import fs from 'fs-extra';
import YAML from 'yaml';
import { loadGentzenScenario, runFactResolvers, collectReferencedAtoms } from './loadFromYaml.js';
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
        }
        results.targets.push({
            formula: target,
            proven: result.proven,
            missingFacts: result.missingFacts,
            path: result.path
        });

        if (onProof) {
            try {
                await onProof({
                    target,
                    proven: result.proven,
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
        logger.error(`❌ Error running Gentzen reasoning: ${error.message}`);
        throw error;
    }
}

export function displayResults(results, options = {}) {
    const { verbose = false } = options;
    const logConfig = getConfigSection('logging');
    const logger = options.logger || createLogger(logConfig);
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
    const failedTargets = results.targets.filter(t => !t.proven);
    logger.info(`${EOL}${chalk.bold(`Target Results: ${provenTargets.length} proven, ${failedTargets.length} failed`)}`);
    for (const target of results.targets) {
        if (target.proven) {
            logger.info(`  ${chalk.green('✅ PROVEN:')} ${target.formula}`);
            if (target.path.length > 0) {
                logger.info(`     ${chalk.gray('Path:')} ${target.path.join(' → ')}`);
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
            return step.ruleType === 'implies' ? 'alpha-IMPLIES' : 'alpha-AND';
        case 'BetaRule':
            return 'beta-OR';
        case 'ContrapositionRule':
            return 'contraposition';
        case 'DoubleNegationRule':
            return step.ruleType === 'doubleNegElim' ? 'doubleNeg-elim' : 'doubleNeg-intro';
        case 'EquivalenceRule':
            return 'equivalence';
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
// @param {boolean} [options.showRawFormulas=true] - Reserved for a future mnemonic-formula mode.
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
                const source = identifyProofSource(target, system, results.availableFacts || []);
                logger.info(`  ${chalk.green('✅ PROVEN ')} ${target.formula}`);
                logger.info(`             ${chalk.gray(source)}`);
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
    const totalCount = targets ? targets.length : 0;
    const color = provenCount === totalCount ? chalk.green : (provenCount === 0 ? chalk.red : chalk.yellow);
    logger.info(`${EOL}${chalk.bold('Result:')} ${color(`${provenCount}/${totalCount} targets proven`)}${EOL}`);
}

// Determine where a proof closed: direct fact, a specific step, or proof search.
//
function identifyProofSource(target, system, availableFacts) {
    let normalizedTarget;
    try {
        normalizedTarget = normalizeFormula(target.formula);
    } catch {
        // If the target won't parse here (it parsed in the engine, but defensive)
        // fall back to the path-length hint.
        return target.path?.length > 0
            ? `via proof search (${target.path.length} steps)`
            : 'matched directly';
    }

    // Fact match (any fact normalizes to the same canonical form).
    for (const fact of availableFacts) {
        try {
            if (normalizeFormula(fact) === normalizedTarget) {
                return 'matches a fact directly';
            }
        } catch {
            // Skip malformed entries.
        }
    }

    // Step match (the formula already appears as a stored step).
    if (system && Array.isArray(system.steps)) {
        for (let i = 0; i < system.steps.length; i += 1) {
            const step = system.steps[i];
            for (const f of step.formulas) {
                try {
                    if (normalizeFormula(f) === normalizedTarget) {
                        if (step.ruleType === 'fact') {
                            return `declared as proposition (step #${i + 1})`;
                        }
                        return `derived at step #${i + 1}`;
                    }
                } catch {
                    // Skip malformed entries.
                }
            }
        }
    }

    // Otherwise it came from BFS expansion during searchForProof.
    const depth = target.path?.length || 0;
    return depth > 0 ? `via proof search (${depth} step${depth === 1 ? '' : 's'})` : 'matched directly';
}
