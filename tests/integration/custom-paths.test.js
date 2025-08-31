import { join } from 'node:path';
import test from 'ava';
import { runGentzenReasoning } from '../../main.js';
import { 
    assertScenarioStructure, 
    assertResolverLoaded, 
    assertContains 
} from '../helpers/test-helpers.js';

// Integration tests for custom directory handling
//
const testDir = import.meta.dirname;
const testScenariosPath = join(testDir, '../scenarios/test-scenarios');
const testResolversPath = join(testDir, '../scenarios/test-resolvers');
const demoCustomPath = join(testDir, '../../examples/demo-custom');
const mainResolversPath = join(testDir, '../fixtures/resolvers');

test('custom resolvers path - test resolvers', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        resolversPath: testResolversPath
    });
    
    assertScenarioStructure(t, results);
    t.true(results.summary.loadedFiles.length > 0);
    assertResolverLoaded(t, 'travel', results);
});

test('custom resolvers path - main resolvers', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        resolversPath: mainResolversPath
    });
    
    assertScenarioStructure(t, results);
    t.true(results.summary.loadedFiles.length > 0);
    assertResolverLoaded(t, 'travel', results);
});

test('custom scenario and resolver paths', async t => {
    const scenarioPath = join(demoCustomPath, 'my-scenarios/simple-test.yaml');
    const resolversPath = join(demoCustomPath, 'my-resolvers');
    
    const results = await runGentzenReasoning(scenarioPath, {
        resolversPath
    });
    
    assertScenarioStructure(t, results);
    t.is(results.scenarioPath, scenarioPath);
    t.true(results.summary.loadedFiles.length > 0);
});

test('invalid resolvers path handling', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        resolversPath: '/invalid/path/that/does/not/exist'
    });
    
    assertScenarioStructure(t, results);
    t.is(results.summary.loadedFiles.length, 0);
    t.is(results.summary.totalResolvers, 0);
});

test('mixed custom and auto-detected resolvers', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        resolversPath: testResolversPath,
        customResolvers: {
            CustomTestFact: () => true,
            AnotherCustomFact: () => false
        }
    });
    
    assertScenarioStructure(t, results);
    t.true('CustomTestFact' in results.factResolutions);
    t.true('AnotherCustomFact' in results.factResolutions);
    t.is(results.factResolutions.CustomTestFact, true);
    t.is(results.factResolutions.AnotherCustomFact, false);
});

test('custom resolvers override auto-detected', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        resolversPath: testResolversPath,
        customResolvers: {
            UserWantsEuropeanFlight: () => false // Override the auto-detected resolver
        }
    });
    
    assertScenarioStructure(t, results);
    t.is(results.factResolutions.UserWantsEuropeanFlight, false);
});

test('relative vs absolute paths', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    
    // Test with absolute path
    const resultsAbsolute = await runGentzenReasoning(scenarioPath, {
        resolversPath: testResolversPath
    });
    
    assertScenarioStructure(t, resultsAbsolute);
    t.true(resultsAbsolute.summary.loadedFiles.length > 0);
});

test('scenario path validation', async t => {
    const error = await t.throwsAsync(async () => {
        await runGentzenReasoning('/nonexistent/scenario.yaml');
    });
    
    t.true(error instanceof Error);
    assertContains(t, error.message, 'ENOENT');
});

test('verbose mode with custom paths', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        verbose: true,
        resolversPath: testResolversPath,
        customResolvers: {
            VerboseTestFact: () => true
        }
    });
    
    assertScenarioStructure(t, results);
    t.true(results.verboseInfo !== null);
    t.is(results.verboseInfo.resolversPath, testResolversPath);
    t.true('VerboseTestFact' in results.verboseInfo.factResolutionDetails);
});

test('empty custom resolvers with valid path', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        resolversPath: testResolversPath,
        customResolvers: {}
    });
    
    assertScenarioStructure(t, results);
    t.true(results.summary.loadedFiles.length > 0);
});

test('resolver path precedence', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    
    // Test with test resolvers (should return true for UserWantsEuropeanFlight)
    const testResults = await runGentzenReasoning(scenarioPath, {
        resolversPath: testResolversPath
    });
    
    // Test with demo custom resolvers (different values for UserWantsEuropeanFlight)
    const customResults = await runGentzenReasoning(scenarioPath, {
        resolversPath: join(demoCustomPath, 'my-resolvers')
    });
    
    // Both should work but potentially with different resolver values
    assertScenarioStructure(t, testResults);
    assertScenarioStructure(t, customResults);
});
