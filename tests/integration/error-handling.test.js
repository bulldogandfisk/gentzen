import { join } from 'node:path';
import test from 'ava';
import { runGentzenReasoning, isAbortedResults, ScenarioAbortedError } from '../../main.js';
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

test('sync-throwing resolver aborts the scenario', async t => {
    // Resolver exceptions are sensor outages, not data. The run is cancelled.
    //
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: {
            UserWantsEuropeanFlight: createFailingMockResolver('Test resolver error')
        }
    });

    t.true(isAbortedResults(results));
    t.is(results.reason, 'resolver_error');
    t.is(results.resolverName, 'UserWantsEuropeanFlight');
    assertContains(t, results.cause, 'Test resolver error');
});

test('multiple failing resolvers - first failure aborts', async t => {
    const scenarioPath = join(testScenariosPath, 'all-rules.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: {
            UserWantsEuropeanFlight: createFailingMockResolver('Error 1'),
            UserHasVisa: createFailingMockResolver('Error 2'),
            ActionA: () => true
        }
    });

    t.true(isAbortedResults(results));
    t.is(results.reason, 'resolver_error');
    // Order of resolver execution is the iteration order of Object.entries on
    // the merged map. The test asserts one of the two failing resolvers
    // surfaced; both are valid.
    //
    t.true(['UserWantsEuropeanFlight', 'UserHasVisa'].includes(results.resolverName));
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

test('resolver file import errors propagate as scenario aborts', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        resolversPath: errorResolversPath
    });

    t.true(isAbortedResults(results));
    t.is(results.reason, 'resolver_error');
});

test('mixed working and failing resolvers - any failure aborts', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: {
            WorkingResolver: () => true,
            FailingResolver: createFailingMockResolver('This should fail'),
            AnotherWorkingResolver: () => false
        }
    });

    t.true(isAbortedResults(results));
    t.is(results.resolverName, 'FailingResolver');
    assertContains(t, results.cause, 'This should fail');
});

test('async-rejecting resolver aborts the scenario', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: {
            AsyncFailingResolver: async () => {
                throw new Error('Async error');
            },
            SyncWorkingResolver: () => true
        }
    });

    t.true(isAbortedResults(results));
    t.is(results.resolverName, 'AsyncFailingResolver');
    assertContains(t, results.cause, 'Async error');
});

test('falsy resolver returns are not aborts (false/0/empty/null/undefined)', async t => {
    // Contract: falsy = false. Only throws/rejections abort. Resolver authors
    // own the "do I have data?" question inside the resolver.
    //
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: {
            ReturnsFalse: () => false,
            ReturnsZero: () => 0,
            ReturnsEmpty: () => '',
            ReturnsNull: () => null,
            ReturnsUndefined: () => undefined
        }
    });

    t.false(isAbortedResults(results));
    t.is(results.factResolutions.ReturnsFalse, false);
    t.is(results.factResolutions.ReturnsZero, false);
    t.is(results.factResolutions.ReturnsEmpty, false);
    t.is(results.factResolutions.ReturnsNull, false);
    t.is(results.factResolutions.ReturnsUndefined, false);
});

test('ScenarioAbortedError is exported and matches abort results', t => {
    t.is(typeof ScenarioAbortedError, 'function');
    const e = new ScenarioAbortedError('Foo', new Error('boom'));
    t.is(e.resolverName, 'Foo');
    t.true(e instanceof Error);
    t.true(e.message.includes('Foo'));
    t.true(e.message.includes('boom'));
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

test('recursive resolver error aborts the scenario', async t => {
    let callCount = 0;
    const recursiveResolver = () => {
        callCount++;
        if (callCount > 1) {
            throw new Error('Recursive call detected');
        }
        return recursiveResolver(); // self-call triggers throw
    };

    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: {
            UserWantsEuropeanFlight: recursiveResolver
        }
    });

    t.true(isAbortedResults(results));
    t.is(results.resolverName, 'UserWantsEuropeanFlight');
});
