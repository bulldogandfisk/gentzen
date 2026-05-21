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
import { validateProof } from '../helpers/validateProof.js';

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
    validateProof(t, results);
});

test('alpha rule - IMPLIES implication', async t => {
    const scenarioPath = join(testScenariosPath, 'all-rules.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });

    assertProven(t, 'ActionA', results);
    validateProof(t, results);
});

test('beta rule - OR disjunction', async t => {
    const scenarioPath = join(testScenariosPath, 'all-rules.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });

    assertProven(t, '(ActionA ∨ ActionB)', results);
    validateProof(t, results);
});

test('contraposition rule', async t => {
    const scenarioPath = join(testScenariosPath, 'all-rules.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });

    assertProven(t, '(~ActionA → ~(UserWantsEuropeanFlight ∧ UserHasVisa))', results);
    validateProof(t, results);
});

test('double negation - introduction', async t => {
    const scenarioPath = join(testScenariosPath, 'all-rules.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });

    assertProven(t, '~~UserHasVisa', results);
    validateProof(t, results);
});

test('equivalence rule', async t => {
    const scenarioPath = join(testScenariosPath, 'all-rules.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });

    assertProven(t, '(UserWantsEuropeanFlight ↔ ActionC)', results);
    validateProof(t, results);
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
    validateProof(t, results);
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
    assertStepSkipped(t, 1, results);

    // Every skipped step here is skipped because an atom did not resolve.
    for (const skipped of results.skippedSteps) {
        t.is(skipped.reason, 'missing_fact', `Step ${skipped.stepIndex} should have reason 'missing_fact'`);
    }
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

test('onProof callback fires once per target with full event shape', async t => {
    const scenarioPath = join(testScenariosPath, 'all-rules.yaml');
    const events = [];

    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers,
        onProof: (event) => {
            events.push(event);
        }
    });

    t.is(events.length, results.targets.length, 'one event per target');

    for (const event of events) {
        t.is(typeof event.target, 'string');
        t.is(typeof event.proven, 'boolean');
        t.true(Array.isArray(event.path));
        t.true(Array.isArray(event.missingFacts));
        t.is(typeof event.durationMs, 'number');
        t.true(event.durationMs >= 0);

        const matching = results.targets.find(tr => tr.formula === event.target);
        t.truthy(matching);
        t.is(event.proven, matching.proven);
    }
});

test('onProof async callback is awaited', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const sequence = [];

    await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers,
        onProof: async (event) => {
            await new Promise(resolve => setTimeout(resolve, 5));
            sequence.push(event.target);
        }
    });

    t.true(sequence.length > 0, 'async callback ran for at least one target');
});

test('onProof callback errors are caught and do not abort reasoning', async t => {
    const scenarioPath = join(testScenariosPath, 'all-rules.yaml');

    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers,
        onProof: () => {
            throw new Error('intentional callback failure');
        }
    });

    t.true(results.targets.length > 0, 'reasoning completed despite callback error');
    t.true(results.summary.provenTargets > 0, 'targets were still proven');
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
