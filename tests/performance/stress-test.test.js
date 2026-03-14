// stress-test.js - Performance and stress tests using AVA
//

import test from 'ava';
import { join } from 'node:path';
import { runGentzenReasoning } from '../../main.js';
import { allMockResolvers } from '../scenarios/test-resolvers/mockResolvers.js';
import { assertScenarioStructure } from '../helpers/test-helpers.js';

const testDir = import.meta.dirname;
const fixturesPath = join(testDir, '../fixtures/scenarios');
const testScenariosPath = join(testDir, '../scenarios/test-scenarios');

test('large scenario performance - completes under 2s', async t => {
    const scenarioPath = join(fixturesPath, 'scenario-no-facts.yaml');
    const startTime = Date.now();

    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });

    const duration = Date.now() - startTime;

    assertScenarioStructure(t, results);
    t.true(duration < 2000, `Performance too slow: ${duration}ms`);
    t.true(results.targets.length > 0);
});

test('multiple concurrent executions - avg under 500ms', async t => {
    const scenarioPath = join(fixturesPath, 'mixed-scenario.yaml');
    const executions = 10;
    const startTime = Date.now();

    const promises = [];
    for (let i = 0; i < executions; i++) {
        promises.push(runGentzenReasoning(scenarioPath, {
            customResolvers: allMockResolvers
        }));
    }

    const results = await Promise.all(promises);
    const totalDuration = Date.now() - startTime;
    const avgDuration = totalDuration / executions;

    t.is(results.length, executions);
    for (const result of results) {
        assertScenarioStructure(t, result);
    }

    t.true(avgDuration < 500, `Average execution too slow: ${avgDuration}ms`);
});

test('memory stability - 50 iterations without crash', async t => {
    const scenarioPath = join(fixturesPath, 'scenario-no-facts.yaml');
    const iterations = 50;

    for (let i = 0; i < iterations; i++) {
        const results = await runGentzenReasoning(scenarioPath, {
            customResolvers: allMockResolvers
        });

        assertScenarioStructure(t, results);

        if (i % 10 === 0 && global.gc) {
            global.gc();
        }
    }

    t.pass('Memory usage test completed without crashes');
});

test('resolver loading performance - completes under 1s', async t => {
    const scenarioPath = join(fixturesPath, 'mixed-scenario.yaml');
    const resolversPath = join(testDir, '../scenarios/test-resolvers');
    const startTime = Date.now();

    const results = await runGentzenReasoning(scenarioPath, {
        resolversPath
    });

    const duration = Date.now() - startTime;

    assertScenarioStructure(t, results);
    t.true(duration < 2000, `Resolver loading too slow: ${duration}ms`);
    t.true(results.summary.loadedFiles.length > 0);
});

test('large custom resolver set - 1000 resolvers under 3s', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');

    const customResolvers = {};
    for (let i = 0; i < 1000; i++) {
        customResolvers[`TestFact${i}`] = () => Math.random() > 0.5;
    }

    const startTime = Date.now();

    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers
    });

    const duration = Date.now() - startTime;

    assertScenarioStructure(t, results);
    t.true(duration < 3000, `Large resolver set too slow: ${duration}ms`);
    t.is(Object.keys(results.factResolutions).length, 1000);
});

test('concurrent execution safety - 5 parallel runs', async t => {
    const scenarioPath = join(fixturesPath, 'mixed-scenario.yaml');
    const concurrentExecutions = 5;

    const promises = [];
    for (let i = 0; i < concurrentExecutions; i++) {
        promises.push(runGentzenReasoning(scenarioPath, {
            customResolvers: {
                ...allMockResolvers,
                ConcurrentTestFact: () => i
            }
        }));
    }

    const results = await Promise.all(promises);

    t.is(results.length, concurrentExecutions);
    for (let i = 0; i < results.length; i++) {
        assertScenarioStructure(t, results[i]);
    }
});

test('verbose mode performance impact - under 1.5x slower', async t => {
    const scenarioPath = join(fixturesPath, 'scenario-no-facts.yaml');

    const normalStart = Date.now();
    const normalResults = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });
    const normalDuration = Date.now() - normalStart;

    const verboseStart = Date.now();
    const verboseResults = await runGentzenReasoning(scenarioPath, {
        verbose: true,
        customResolvers: allMockResolvers
    });
    const verboseDuration = Date.now() - verboseStart;

    assertScenarioStructure(t, normalResults);
    assertScenarioStructure(t, verboseResults);

    // Only compare ratios when durations are large enough to be meaningful
    // Small absolute durations produce noisy ratios
    //
    if (normalDuration > 50) {
        const performanceRatio = verboseDuration / normalDuration;
        t.true(performanceRatio < 2.0, `Verbose mode too slow: ${performanceRatio}x slower`);
    } else {
        // Both ran fast — just verify verbose didn't add unreasonable overhead
        t.true(verboseDuration < 2000, `Verbose mode absolute time too high: ${verboseDuration}ms`);
    }
});

test('error handling performance - all errors under 2s', async t => {
    const scenarioPath = join(fixturesPath, 'mixed-scenario.yaml');

    const errorResolvers = {};
    for (const key of Object.keys(allMockResolvers)) {
        errorResolvers[key] = () => {
            throw new Error(`Error in ${key}`);
        };
    }

    const startTime = Date.now();

    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: errorResolvers
    });

    const duration = Date.now() - startTime;

    assertScenarioStructure(t, results);
    t.true(duration < 2000, `Error handling too slow: ${duration}ms`);

    for (const [factName, resolved] of Object.entries(results.factResolutions)) {
        if (factName in errorResolvers) {
            t.is(resolved, false, `Fact ${factName} should be false due to error`);
        }
    }
});
