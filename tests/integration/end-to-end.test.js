import { join } from 'node:path';
import test from 'ava';
import { runGentzenReasoning, displayResults } from '../../main.js';
import { allMockResolvers } from '../scenarios/test-resolvers/mockResolvers.js';
import { 
    assertScenarioStructure, 
    assertResolverLoaded, 
    assertProven 
} from '../helpers/test-helpers.js';

// End-to-end workflow tests.
//

const testDir = import.meta.dirname;
const mainScenariosPath = join(testDir, '../fixtures/scenarios');
const mainResolversPath = join(testDir, '../fixtures/resolvers');
const demoCustomPath = join(testDir, '../../examples/demo-custom');

test('travel booking workflow - complete scenario', async t => {
    const scenarioPath = join(mainScenariosPath, 'scenario-no-facts.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        resolversPath: mainResolversPath,
        verbose: true
    });
    
    assertScenarioStructure(t, results);
    t.true(results.targets.length >= 8); // scenario-no-facts has 8 targets
    t.true(results.summary.provenTargets > 0);
    assertResolverLoaded(t, 'travel', results);
    
    // Check for key travel-related targets
    const targetFormulas = results.targets.map(t => t.formula);
    t.true(targetFormulas.some(f => f.includes('European')));
});

test('system monitoring workflow', async t => {
    const scenarioPath = join(mainScenariosPath, 'system-scenario.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: {
            SystemHealthy: () => true,
            DatabaseConnected: () => true,
            BackupCompleted: () => true,
            SecurityScanPassed: () => true,
            DiskSpaceAvailable: () => true
        },
        verbose: true
    });
    
    assertScenarioStructure(t, results);
    assertProven(t, '(SystemHealthy ∧ DatabaseConnected)', results);
    assertProven(t, '((SystemHealthy ∧ DatabaseConnected) → SystemAlert)', results);
});

test('mixed business and system workflow', async t => {
    const scenarioPath = join(mainScenariosPath, 'mixed-scenario.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        resolversPath: mainResolversPath,
        verbose: true
    });
    
    assertScenarioStructure(t, results);
    t.true(results.summary.loadedFiles.length >= 3); // business, system, time
    assertResolverLoaded(t, 'business', results);
    assertResolverLoaded(t, 'system', results);
    assertResolverLoaded(t, 'time', results);
});

test('custom test environment workflow', async t => {
    const scenarioPath = join(demoCustomPath, 'my-scenarios/simple-test.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        resolversPath: join(demoCustomPath, 'my-resolvers'),
        customResolvers: {
            CustomTestFact: () => true
        },
        verbose: true
    });
    
    assertScenarioStructure(t, results);
    t.true('CustomTestFact' in results.factResolutions);
    t.is(results.factResolutions.CustomTestFact, true);
});

test('all rule types integration', async t => {
    const scenarioPath = join(mainScenariosPath, 'scenario-no-facts.yaml');
    // Provide resolvers that make facts available for equivalence step
    const customResolvers = {
        ...allMockResolvers,
        TravelingWithDog: () => true, // Make this true so equivalence step can execute
        UserHasOperaInterest: () => true // Also make this true to enable more steps
    };
    
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers,
        verbose: true
    });
    
    assertScenarioStructure(t, results);
    
    // Check that various rule types were applied
    const steps = results.system.steps;
    const ruleTypes = steps.map(step => step.ruleType);
    
    t.true(ruleTypes.includes('and') || ruleTypes.includes('implies')); // alpha rules
    t.true(ruleTypes.includes('or')); // beta rules
    t.true(ruleTypes.includes('contraposition'));
    t.true(ruleTypes.includes('doubleNegIntro') || ruleTypes.includes('doubleNegElim')); // double negation
    t.true(ruleTypes.includes('equiv')); // equivalence
});

test('performance with large scenario', async t => {
    const scenarioPath = join(mainScenariosPath, 'scenario-no-facts.yaml');
    const startTime = Date.now();
    
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    assertScenarioStructure(t, results);
    t.true(duration < 5000); // Should complete within 5 seconds
    t.true(results.targets.length > 0);
});

test('regression test - existing demo scenarios', async t => {
    // Test that all existing demo functionality still works
    const scenarios = [
        'mixed-scenario.yaml',
        'system-scenario.yaml',
        'scenario-no-facts.yaml'
    ];
    
    for (const scenario of scenarios) {
        const scenarioPath = join(mainScenariosPath, scenario);
        const results = await runGentzenReasoning(scenarioPath, {
            resolversPath: mainResolversPath
        });
        
        assertScenarioStructure(t, results);
        t.true(results.targets.length > 0, `No targets in ${scenario}`);
    }
});

test('displayResults function integration', async t => {
    const scenarioPath = join(mainScenariosPath, 'mixed-scenario.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers,
        verbose: true
    });
    
    // Test that displayResults doesn't throw
    assertScenarioStructure(t, results);
    
    // This would normally output to console, but we're just testing it doesn't crash
    try {
        displayResults(results);
        displayResults(results, { verbose: true });
    } catch (error) {
        t.fail(`displayResults threw error: ${error.message}`);
    }
});

test('fact resolver auto-detection workflow', async t => {
    const scenarioPath = join(mainScenariosPath, 'mixed-scenario.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        resolversPath: mainResolversPath
    });
    
    assertScenarioStructure(t, results);
    t.true(results.summary.loadedFiles.length > 0);
    t.true(results.summary.totalResolvers > 0);
    
    // Verify that facts from different modules were resolved
    const factNames = Object.keys(results.factResolutions);
    const hasBusinessFacts = factNames.some(name => name.includes('Customer') || name.includes('Payment'));
    const hasSystemFacts = factNames.some(name => name.includes('System') || name.includes('Database'));
    const hasTimeFacts = factNames.some(name => name.includes('Business') && name.includes('Hours'));
    
    // At least some of these should be true
    t.true(hasBusinessFacts || hasSystemFacts || hasTimeFacts);
});

test('mixed resolver sources workflow', async t => {
    const scenarioPath = join(mainScenariosPath, 'mixed-scenario.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        resolversPath: mainResolversPath,
        customResolvers: {
            CustomBusinessRule: () => true,
            OverrideSystemHealthy: () => false // Override auto-detected
        }
    });
    
    assertScenarioStructure(t, results);
    t.true('CustomBusinessRule' in results.factResolutions);
    t.is(results.factResolutions.CustomBusinessRule, true);
    
    // Custom resolver should override auto-detected one
    if ('OverrideSystemHealthy' in results.factResolutions) {
        t.is(results.factResolutions.OverrideSystemHealthy, false);
    }
});

test('complete workflow with all options', async t => {
    const scenarioPath = join(mainScenariosPath, 'scenario-no-facts.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        verbose: true,
        resolversPath: mainResolversPath,
        customResolvers: {
            WorkflowTestFact: () => true,
            AnotherWorkflowFact: () => false
        }
    });
    
    assertScenarioStructure(t, results);
    t.true(results.verboseInfo !== null);
    t.true(results.summary.loadedFiles.length > 0);
    t.true('WorkflowTestFact' in results.factResolutions);
    t.true('AnotherWorkflowFact' in results.factResolutions);
    t.is(results.factResolutions.WorkflowTestFact, true);
    t.is(results.factResolutions.AnotherWorkflowFact, false);
});

test('backward compatibility test', async t => {
    // Test that the old demo scripts would still work
    const scenarioPath = join(mainScenariosPath, 'mixed-scenario.yaml');
    
    // Test without any options (like the old test-pure-reasoning.js)
    const results1 = await runGentzenReasoning(scenarioPath);
    assertScenarioStructure(t, results1);
    
    // Test with verbose (like the old test-function-call.js)
    const results2 = await runGentzenReasoning(scenarioPath, { verbose: true });
    assertScenarioStructure(t, results2);
    t.true(results2.verboseInfo !== null);
    
    // Test with custom path (like the old test-custom-paths.js)
    const customScenario = join(demoCustomPath, 'my-scenarios/simple-test.yaml');
    const results3 = await runGentzenReasoning(customScenario, {
        resolversPath: join(demoCustomPath, 'my-resolvers')
    });
    assertScenarioStructure(t, results3);
});
