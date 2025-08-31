import { join } from 'node:path';
import test from 'ava';
import { runGentzenReasoning } from '../../main.js';
import { createFailingMockResolver } from '../scenarios/test-resolvers/mockResolvers.js';
import { 
    assertScenarioStructure, 
    assertContains 
} from '../helpers/test-helpers.js';

// Integration tests for error condition handling
//

const testDir = import.meta.dirname;
const testScenariosPath = join(testDir, '../scenarios/test-scenarios');
const errorResolversPath = join(testDir, '../scenarios/error-resolvers');

test('resolver errors - graceful handling', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: {
            UserWantsEuropeanFlight: createFailingMockResolver('Test resolver error')
        }
    });
    
    assertScenarioStructure(t, results);
    t.is(results.factResolutions.UserWantsEuropeanFlight, false);
});

test('multiple resolver errors', async t => {
    const scenarioPath = join(testScenariosPath, 'all-rules.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: {
            UserWantsEuropeanFlight: createFailingMockResolver('Error 1'),
            UserHasVisa: createFailingMockResolver('Error 2'),
            ActionA: () => true // This one should work
        }
    });
    
    assertScenarioStructure(t, results);
    t.is(results.factResolutions.UserWantsEuropeanFlight, false);
    t.is(results.factResolutions.UserHasVisa, false);
    t.is(results.factResolutions.ActionA, true);
});

test('invalid scenario YAML - malformed syntax', async t => {
    const scenarioPath = join(testScenariosPath, 'invalid-syntax.yaml');
    
    // Should not throw, but handle gracefully
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: {
            UserWantsEuropeanFlight: () => true,
            UserHasVisa: () => true
        }
    });
    
    assertScenarioStructure(t, results);
    // Invalid steps should be skipped, not crash the system
});

test('nonexistent scenario file', async t => {
    const scenarioPath = join(testScenariosPath, 'does-not-exist.yaml');
    
    const error = await t.throwsAsync(async () => {
        await runGentzenReasoning(scenarioPath);
    });
    
    t.true(error instanceof Error);
    assertContains(t, error.message, 'ENOENT');
});

test('nonexistent resolver directory', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        resolversPath: '/completely/invalid/path'
    });
    
    assertScenarioStructure(t, results);
    t.is(results.summary.loadedFiles.length, 0);
    t.is(results.summary.totalResolvers, 0);
});

test('resolver file import errors', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        resolversPath: errorResolversPath // Contains resolvers that throw errors
    });
    
    assertScenarioStructure(t, results);
    // Should handle resolver errors and set facts to false
    t.true('UserWantsEuropeanFlight' in results.factResolutions);
    t.is(results.factResolutions.UserWantsEuropeanFlight, false);
});

test('mixed working and failing resolvers', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: {
            WorkingResolver: () => true,
            FailingResolver: createFailingMockResolver('This should fail'),
            AnotherWorkingResolver: () => false
        }
    });
    
    assertScenarioStructure(t, results);
    t.is(results.factResolutions.WorkingResolver, true);
    t.is(results.factResolutions.FailingResolver, false);
    t.is(results.factResolutions.AnotherWorkingResolver, false);
});

test('async resolver errors', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: {
            AsyncFailingResolver: async () => {
                throw new Error('Async error');
            },
            SyncWorkingResolver: () => true
        }
    });
    
    assertScenarioStructure(t, results);
    // Async resolvers that throw errors should resolve to false
    t.is(results.factResolutions.AsyncFailingResolver, false);
    t.is(results.factResolutions.SyncWorkingResolver, true);
});

test('null and undefined resolver handling', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: {
            NullResolver: null,
            UndefinedResolver: undefined,
            FunctionResolver: () => true
        }
    });
    
    assertScenarioStructure(t, results);
    t.is(results.factResolutions.NullResolver, false);
    t.is(results.factResolutions.UndefinedResolver, false);
    t.is(results.factResolutions.FunctionResolver, true);
});

test('empty scenario handling', async t => {
    // Test with minimal scenario and no resolvers
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: {}, // Empty resolvers
        resolversPath: '/nonexistent/path' // Disable auto-loading
    });
    
    assertScenarioStructure(t, results);
    t.true(results.missingFacts.includes('UserWantsEuropeanFlight'));
    t.true(results.missingFacts.length > 0);
});

test('timeout handling simulation', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    
    // Test with very slow resolver (simulating timeout scenario)
    const slowResolver = () => {
        // Simulate slow operation
        const start = Date.now();
        while (Date.now() - start < 10) {
            // Small delay
        }
        return true;
    };
    
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: {
            UserWantsEuropeanFlight: slowResolver
        }
    });
    
    assertScenarioStructure(t, results);
    t.is(results.factResolutions.UserWantsEuropeanFlight, true);
});

test('recursive resolver error', async t => {
    let callCount = 0;
    const recursiveResolver = () => {
        callCount++;
        if (callCount > 1) {
            throw new Error('Recursive call detected');
        }
        return recursiveResolver(); // This would cause infinite recursion
    };
    
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: {
            UserWantsEuropeanFlight: recursiveResolver
        }
    });
    
    assertScenarioStructure(t, results);
    t.is(results.factResolutions.UserWantsEuropeanFlight, false);
});
