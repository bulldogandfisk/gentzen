import { join } from 'node:path';
import test from 'ava';
import { runGentzenReasoning } from '../../main.js';
import { allMockResolvers } from '../scenarios/test-resolvers/mockResolvers.js';
import { 
    assertScenarioStructure, 
    assertProven, 
    assertMissingFacts, 
    assertFactResolved, 
    assertStepSkipped 
} from '../helpers/test-helpers.js';

// Integration tests for scenario execution
//

const testDir = import.meta.dirname;
const testScenariosPath = join(testDir, '../scenarios/test-scenarios');
const mainScenariosPath = join(testDir, '../fixtures/scenarios');

test('alpha rule - AND conjunction', async t => {
    const scenarioPath = join(testScenariosPath, 'all-rules.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });
    
    assertProven(t, '(UserWantsEuropeanFlight ∧ UserHasVisa)', results);
    t.true(results.summary.provenTargets > 0);
});

test('alpha rule - IMPLIES implication', async t => {
    const scenarioPath = join(testScenariosPath, 'all-rules.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });
    
    assertProven(t, 'ActionA', results);
});

test('beta rule - OR disjunction', async t => {
    const scenarioPath = join(testScenariosPath, 'all-rules.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });
    
    assertProven(t, '(ActionA ∨ ActionB)', results);
});

test('contraposition rule', async t => {
    const scenarioPath = join(testScenariosPath, 'all-rules.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });
    
    assertProven(t, '(~ActionA → ~(UserWantsEuropeanFlight ∧ UserHasVisa))', results);
});

test('double negation - introduction', async t => {
    const scenarioPath = join(testScenariosPath, 'all-rules.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });
    
    assertProven(t, '~~UserHasVisa', results);
});

test('equivalence rule', async t => {
    const scenarioPath = join(testScenariosPath, 'all-rules.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });
    
    assertProven(t, '(UserWantsEuropeanFlight ↔ ActionC)', results);
});

test('mixed scenario - business and system facts', async t => {
    const scenarioPath = join(mainScenariosPath, 'mixed-scenario.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });
    
    assertScenarioStructure(t, results);
    t.true(results.targets.length >= 4);
    t.true(results.summary.provenTargets > 0);
});

test('system monitoring scenario', async t => {
    const scenarioPath = join(mainScenariosPath, 'system-scenario.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });
    
    assertScenarioStructure(t, results);
    assertProven(t, '(SystemHealthy ∧ DatabaseConnected)', results);
});

test('scenario with no facts - comprehensive', async t => {
    const scenarioPath = join(mainScenariosPath, 'scenario-no-facts.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });
    
    assertScenarioStructure(t, results);
    t.true(results.targets.length > 0);
    t.true(results.summary.provenTargets > 0);
});

test('missing facts handling', async t => {
    const scenarioPath = join(testScenariosPath, 'missing-facts.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });
    
    assertMissingFacts(t, ['NonExistentFact1', 'NonExistentFact2'], results);
    t.true(results.skippedSteps.length > 0);
    assertStepSkipped(t, 1, results); // First step should be skipped
});

test('invalid syntax graceful handling', async t => {
    const scenarioPath = join(testScenariosPath, 'invalid-syntax.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });
    
    assertScenarioStructure(t, results);
    // Should not crash, even with invalid syntax
    t.true(results.targets.length > 0);
});

test('fact resolution with various types', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const customResolvers = {
        UserWantsEuropeanFlight: () => true,
        TestBooleanTrue: true,
        TestBooleanFalse: false,
        TestString: 'hello',
        TestNumber: 42,
        TestNull: null,
        TestUndefined: undefined
    };
    
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers
    });
    
    assertFactResolved(t, 'UserWantsEuropeanFlight', results);
    t.is(results.factResolutions.TestBooleanTrue, true);
    t.is(results.factResolutions.TestBooleanFalse, false);
    t.is(results.factResolutions.TestString, true);
    t.is(results.factResolutions.TestNumber, true);
    t.is(results.factResolutions.TestNull, false);
    t.is(results.factResolutions.TestUndefined, false);
});

test('step execution order', async t => {
    const scenarioPath = join(testScenariosPath, 'all-rules.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });
    
    assertScenarioStructure(t, results);
    t.true(results.system.steps.length > 0);
    
    // Check that steps are processed in order
    const stepFormulas = results.system.steps.map(step => [...step.formulas][0]);
    t.true(stepFormulas.length > 0);
});

test('target evaluation completeness', async t => {
    const scenarioPath = join(testScenariosPath, 'all-rules.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });
    
    t.is(results.targets.length, results.summary.totalTargets);
    t.is(
        results.targets.filter(t => t.proven).length,
        results.summary.provenTargets
    );
});

test('verbose mode information completeness', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        verbose: true,
        customResolvers: allMockResolvers
    });
    
    t.true(results.verboseInfo !== null);
    t.true('loadedFiles' in results.verboseInfo);
    t.true('factResolutionDetails' in results.verboseInfo);
    t.true('resolversPath' in results.verboseInfo);
});
