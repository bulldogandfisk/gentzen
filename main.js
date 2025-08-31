import { EOL } from 'node:os';
import fs from 'fs';
import YAML from 'yaml';
import { loadGentzenScenario, runFactResolvers } from './loadFromYaml.js';
import { discoverResolvers } from './resolverDiscovery.js';
import { validateScenario } from './validator.js';
import { createLogger } from './utilities/logger.js';
import { getConfigSection } from './utilities/config.js';
import { addFormulaAtomsToSet } from './utilities/formulaUtils.js';
import chalk from 'chalk';

// Extract referenced atoms from scenario file without full processing
function extractReferencedAtomsFromScenario(scenarioPath) {
    const fileContent = fs.readFileSync(scenarioPath, 'utf8');
    const scenario = YAML.parse(fileContent);
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

// Extracted validation logic to handle scenario validation with proper logging
function handleScenarioValidation(scenarioPath, options = {}) {
    const { verbose = false, logger } = options;
    
    if (verbose) {
        logger.info('🔍 Validating scenario...');
    }
    
    const validation = validateScenario(scenarioPath);
    
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

// Extracted resolver discovery logic to handle resolver loading and merging
async function handleResolverDiscovery(resolversPath, customResolvers = {}, requiredAtoms = null) {
    let discoveredResolvers = {};
    let loadedFiles = [];
    let totalResolvers = 0;
    
    if (resolversPath) {
        const discovery = await discoverResolvers(resolversPath);
        discoveredResolvers = discovery.resolvers;
        loadedFiles = discovery.loadedFiles;
        totalResolvers = discovery.totalResolvers;
    }
    
    // Merge discovered resolvers with any custom resolvers provided
    // Custom resolvers take precedence over discovered ones
    const allResolvers = { ...discoveredResolvers, ...customResolvers };
    
    // Filter resolvers to only required atoms if selective resolution is enabled
    const filteredResolvers = requiredAtoms ? 
        Object.fromEntries(
            Object.entries(allResolvers).filter(([name]) => requiredAtoms.has(name))
        ) : allResolvers;
    
    // Run fact resolvers to determine which facts are available
    const factMap = await runFactResolvers(filteredResolvers);
    
    return {
        allResolvers,
        factMap,
        loadedFiles,
        totalResolvers
    };
}

// Extracted result building logic to create initial results structure
function buildInitialResults(scenarioPath, system, targets, factMap, loadedFiles, totalResolvers, verboseInfo, propositions = []) {
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
        verboseInfo,
        system
    };
}

// Extracted target evaluation logic to process all targets and update results
function evaluateTargets(targets, system, results) {
    for (const target of targets) {
        const result = system.searchForProof(target, 5);
        if (result.proven) {
            results.summary.provenTargets++;
        }
        results.targets.push({
            formula: target,
            proven: result.proven,
            missingFacts: result.missingFacts,
            path: result.path
        });
    }
    return results;
}

// Main exported function for running Gentzen reasoning
export async function runGentzenReasoning(scenarioPath, options = {}) {
    const {
        verbose = false,
        customResolvers = {},
        resolversPath,
        validate = false,
        selectiveResolution = false
    } = options;

    // Create logger instance for this operation
    const logConfig = getConfigSection('logging');
    const logger = createLogger(logConfig);

    try {
        // Optional validation step (non-breaking).
        //
        if (validate) {
            handleScenarioValidation(scenarioPath, { verbose, logger });
        }
        
        // Extract required atoms for selective resolution if enabled
        let requiredAtoms = null;
        if (selectiveResolution && resolversPath) {
            try {
                requiredAtoms = extractReferencedAtomsFromScenario(scenarioPath);
                if (verbose) {
                    logger.info(`🎯 Selective resolution: ${requiredAtoms.size} atoms required`);
                }
            } catch (error) {
                logger.warn(`Failed to extract atoms for selective resolution: ${error.message}`);
            }
        }
        
        // Discover and merge resolvers.
        //
        const { allResolvers, factMap, loadedFiles, totalResolvers } = await handleResolverDiscovery(resolversPath, customResolvers, requiredAtoms);
        
        // Store verbose info in results for display function.
        //
        const verboseInfo = verbose ? {
            loadedFiles: loadedFiles.map(f => f.replace(process.cwd(), '.')),
            factResolutionDetails: factMap,
            resolversPath
        } : null;
        
        const { system, targets, propositions } = await loadGentzenScenario(scenarioPath, factMap);
        const results = buildInitialResults(scenarioPath, system, targets, factMap, loadedFiles, totalResolvers, verboseInfo, propositions);
        
        // Evaluate all targets and update results.
        //
        evaluateTargets(targets, system, results);

        return results;
        
    } catch (error) {
        logger.error(`❌ Error running Gentzen reasoning: ${error.message}`);
        throw error;
    }
}

export function displayResults(results, options = {}) {
    const { verbose = false } = options;
    const { system, factResolutions, verboseInfo, scenarioPath, propositions } = results;

    const logConfig = getConfigSection('logging');
    const logger = createLogger(logConfig);
    
    const scenarioName = scenarioPath.split('/').pop();
    logger.info(`📁 Scenario: ${scenarioName}`);

    // Display propositions if they exist
    if (propositions && propositions.length > 0) {
        console.log(`${EOL}${chalk.bold('📋 Propositions:')}`);
        propositions.forEach(proposition => {
            console.log(`  ${chalk.blue('•')} ${proposition}`);
        });
    }

    if (verbose && verboseInfo) {
        const resolverFiles = verboseInfo.loadedFiles.join(`, `);
        logger.debug(`🔧 Loaded resolver files:`, resolverFiles);
        console.log(`${EOL}🔧 Loaded resolver files:`, resolverFiles);
        
        logger.debug(`🔍 Running Fact Resolvers...`);
        console.log(`${EOL}🔍 Running Fact Resolvers...`);
        
        for (const [fact, resolved] of Object.entries(verboseInfo.factResolutionDetails)) {
            const status = resolved ? '✅' : '❌';
            const message = `  ${status} ${fact}`;
            logger.debug(message);
            console.log(message);
        }
    }
    
    logger.info('=== REASONING RESULTS ===');

    console.log(`${EOL}${chalk.bold('Available Facts:')}`);
    for (const fact of results.availableFacts) {
        console.log(`  ${chalk.green('✓')} ${fact}`);
    }
    
    if (results.missingFacts.length > 0) {
        logger.warn('Missing Facts:', results.missingFacts);
        console.log(`${EOL}${chalk.bold('Missing Facts:')}`);
        for (const fact of results.missingFacts) {
            console.log(`  ${chalk.red('✗')} ${fact}`);
        }
    }
    
    // Print target results.
    //
    const provenTargets = results.targets.filter(t => t.proven);
    const failedTargets = results.targets.filter(t => !t.proven);
    logger.info(`Target Results: ${provenTargets.length} proven, ${failedTargets.length} failed`);
    
    console.log(`${EOL}${chalk.bold('Target Results:')}`);
    for (const target of results.targets) {
        if (target.proven) {
            console.log(`  ${chalk.green('✅ PROVEN:')} ${target.formula}`);
            if (target.path.length > 0) {
                console.log(`     ${chalk.gray('Path:')} ${target.path.join(' → ')}`);
            }
        } else {
            console.log(`  ${chalk.red('❌ FAILED:')} ${target.formula}`);
            if (target.missingFacts.length > 0) {
                console.log(`     ${chalk.yellow('Missing:')} ${target.missingFacts.join(', ')}`);
            }
        }
    }
    
    
    // Show detailed steps if verbose
    if (verbose && system) {
        logger.debug(`=== PROOF STEPS ===`);
        console.log(`${EOL}${chalk.bold('=== PROOF STEPS ===')}`);
        for (let i = 0; i < system.steps.length; i += 1) {
            const step = system.steps[i];
            const formula = [...step.formulas][0];
            const fromIndices = step.from
            .map(s => system.steps.indexOf(s) + 1)
            .join(', ') || '-';
            
            logger.debug(`Step #${i + 1}: ${step.origin} [${step.ruleType}] from: ${fromIndices} formula: ${formula}`);
            console.log(`${chalk.blue(`Step #${i + 1}:`)} ${step.origin} [${step.ruleType}]`);
            console.log(`  from: ${fromIndices}`);
            console.log(`  formula: ${chalk.green(formula)}`);
            console.log('---');
        }
        
        if (verboseInfo?.resolversPath) {
            logger.debug(`Loaded from: ${verboseInfo.resolversPath}`);
            console.log(`${EOL}🔧 Loaded from: ${verboseInfo.resolversPath}`);
        }
    }
    
    if (results.skippedSteps.length > 0) {
        logger.warn(`⏸️ Skipped Steps: ${results.skippedSteps.length} steps skipped`);
    }
    console.log(`${EOL}${chalk.bold('⏸️ Skipped Steps:')}`);
    results.skippedSteps.forEach((step, i) => {
        console.log(`${i + 1}. Step ${step.stepIndex} (${step.rule}): Missing ${step.missingFacts.join(', ')}`);
    });
    
    console.log(`${EOL}${chalk.bold('🔍 Fact Resolutions:')}`);
    Object.entries(results.factResolutions).forEach(([fact, resolved]) => {
        const status = resolved ? '✅' : '❌';
        console.log(`  ${status} ${fact}`);
    });
}



