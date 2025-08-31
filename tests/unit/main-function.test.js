// main-function.test.js - Unit tests for main function functionality

import test from 'ava';
import { join } from 'node:path';
import { runGentzenReasoning } from '../../main.js';
import { allMockResolvers } from '../scenarios/test-resolvers/mockResolvers.js';
import { assertScenarioStructure, assertContains } from '../helpers/test-helpers.js';

const testDir = import.meta.dirname;
const testScenariosPath = join(testDir, '../scenarios/test-scenarios');
const testResolversPath = join(testDir, '../scenarios/test-resolvers');

test('runGentzenReasoning - basic functionality', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });
    
    assertScenarioStructure(t, results);
    t.is(results.scenarioPath, scenarioPath);
    t.true(results.targets.length > 0);
    t.true(results.summary.totalTargets > 0);
});

test('runGentzenReasoning - custom resolvers path', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        resolversPath: testResolversPath
    });
    
    assertScenarioStructure(t, results);
    t.true(results.summary.loadedFiles.length > 0);
    t.true(results.summary.totalResolvers > 0);
});

test('runGentzenReasoning - verbose mode', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        verbose: true,
        customResolvers: allMockResolvers
    });
    
    assertScenarioStructure(t, results);
    t.truthy(results.verboseInfo);
    t.true('loadedFiles' in results.verboseInfo);
    t.true('factResolutionDetails' in results.verboseInfo);
});

test('runGentzenReasoning - mixed custom and auto resolvers', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        resolversPath: testResolversPath,
        customResolvers: {
            CustomTestFact: () => true
        }
    });
    
    assertScenarioStructure(t, results);
    t.true('CustomTestFact' in results.factResolutions);
    t.is(results.factResolutions.CustomTestFact, true);
});

test('runGentzenReasoning - missing facts scenario', async t => {
    const scenarioPath = join(testScenariosPath, 'missing-facts.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });
    
    assertScenarioStructure(t, results);
    t.true(results.missingFacts.length > 0);
    t.true(results.skippedSteps.length > 0);
    t.true(results.summary.skippedSteps > 0);
});

test('runGentzenReasoning - all rules scenario', async t => {
    const scenarioPath = join(testScenariosPath, 'all-rules.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });
    
    assertScenarioStructure(t, results);
    t.true(results.targets.length >= 6);
    t.true(results.summary.totalTargets >= 6);
});

test('runGentzenReasoning - default options', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        resolversPath: testResolversPath
    });
    
    assertScenarioStructure(t, results);
    t.is(results.verboseInfo, null);
});

test('runGentzenReasoning - nonexistent scenario', async t => {
    const scenarioPath = join(testScenariosPath, 'nonexistent.yaml');
    
    const error = await t.throwsAsync(async () => {
        await runGentzenReasoning(scenarioPath, {
            resolversPath: testResolversPath
        });
    });
    
    t.true(error instanceof Error);
    assertContains(t, error.message, 'ENOENT');
});

test('runGentzenReasoning - results structure validation', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });
    
    // Check all required fields exist
    const requiredFields = [
        'scenarioPath', 'targets', 'summary', 'availableFacts', 
        'missingFacts', 'skippedSteps', 'factResolutions', 'verboseInfo', 'system'
    ];
    
    for (const field of requiredFields) {
        t.true(field in results, `Missing required field: ${field}`);
    }
    
    // Check summary structure
    const summaryFields = [
        'totalTargets', 'provenTargets', 'availableFacts', 
        'missingFacts', 'skippedSteps', 'loadedFiles', 'totalResolvers'
    ];
    
    for (const field of summaryFields) {
        t.true(field in results.summary, `Missing summary field: ${field}`);
    }
});

test('runGentzenReasoning - target results structure', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });
    
    t.true(results.targets.length > 0);
    
    for (const target of results.targets) {
        t.true('formula' in target);
        t.true('proven' in target);
        t.true('missingFacts' in target);
        t.true('path' in target);
        t.is(typeof target.proven, 'boolean');
        t.true(Array.isArray(target.missingFacts));
        t.true(Array.isArray(target.path));
    }
});