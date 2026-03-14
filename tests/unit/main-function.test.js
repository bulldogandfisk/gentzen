// main-function.test.js - Unit tests for main function functionality

import test from 'ava';
import { join } from 'node:path';
import { EOL } from 'node:os';
import fs from 'node:fs';
import os from 'node:os';
import { runGentzenReasoning, displayResults } from '../../main.js';
import { allMockResolvers } from '../scenarios/test-resolvers/mockResolvers.js';
import { assertScenarioStructure, assertContains } from '../helpers/test-helpers.js';

const testDir = import.meta.dirname;
const testScenariosPath = join(testDir, '../scenarios/test-scenarios');
const testResolversPath = join(testDir, '../scenarios/test-resolvers');

function createTempScenario(content) {
    const tmpDir = fs.mkdtempSync(join(os.tmpdir(), 'gentzen-main-test-'));
    const tmpFile = join(tmpDir, 'test-scenario.yaml');
    fs.writeFileSync(tmpFile, content, 'utf8');
    return { tmpFile, tmpDir };
}

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

test('runGentzenReasoning - validate option on valid scenario succeeds', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers,
        validate: true
    });

    assertScenarioStructure(t, results);
    t.true(results.targets.length > 0);
});

test('runGentzenReasoning - validate verbose on valid scenario logs success', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers,
        validate: true,
        verbose: true
    });

    assertScenarioStructure(t, results);
    t.truthy(results.verboseInfo);
});

test('runGentzenReasoning - validate option on scenario with issues still runs', async t => {
    const scenarioPath = join(testScenariosPath, 'missing-facts.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers,
        validate: true
    });

    assertScenarioStructure(t, results);
});

test('runGentzenReasoning - selectiveResolution verbose logs atom count', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        resolversPath: testResolversPath,
        selectiveResolution: true,
        verbose: true
    });

    assertScenarioStructure(t, results);
    t.truthy(results.verboseInfo);
});

test('runGentzenReasoning - selectiveResolution with resolversPath', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        resolversPath: testResolversPath,
        selectiveResolution: true
    });

    assertScenarioStructure(t, results);
});

test('runGentzenReasoning - selectiveResolution without resolversPath does not break', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers,
        selectiveResolution: true
    });

    assertScenarioStructure(t, results);
});

test('displayResults - verbose false runs without error', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });

    t.notThrows(() => {
        displayResults(results, { verbose: false });
    });
});

test('displayResults - empty targets runs without error', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });

    // Override targets to empty to test edge case
    const modifiedResults = { ...results, targets: [] };
    t.notThrows(() => {
        displayResults(modifiedResults, { verbose: false });
    });
});

test('displayResults - verbose mode with resolver details', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        verbose: true,
        resolversPath: testResolversPath
    });

    t.notThrows(() => {
        displayResults(results, { verbose: true });
    });
});

test('displayResults - skipped steps display', async t => {
    const scenarioPath = join(testScenariosPath, 'missing-facts.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });

    t.true(results.skippedSteps.length > 0);
    t.notThrows(() => {
        displayResults(results, { verbose: false });
    });
});

test('displayResults - resolver errors display', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });

    // Inject resolver errors to test the display branch
    //
    const modifiedResults = {
        ...results,
        resolverErrors: [
            { file: 'badFile.js', error: 'Module not found' }
        ]
    };
    t.notThrows(() => {
        displayResults(modifiedResults, { verbose: false });
    });
});

test('displayResults - missing facts display', async t => {
    const scenarioPath = join(testScenariosPath, 'missing-facts.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });

    t.true(results.missingFacts.length > 0);
    t.notThrows(() => {
        displayResults(results, { verbose: false });
    });
});

test('displayResults - proven target with path display', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: allMockResolvers
    });

    // Inject a proven target with a non-empty path
    //
    const modifiedResults = {
        ...results,
        targets: [
            { formula: 'A', proven: true, missingFacts: [], path: ['step_1', 'final_step'] },
            { formula: 'B', proven: false, missingFacts: ['B'], path: [] }
        ]
    };
    t.notThrows(() => {
        displayResults(modifiedResults, { verbose: false });
    });
});

test('runGentzenReasoning - resolver file import errors trigger warning path', async t => {
    // Create a resolver directory with a broken .js file
    //
    const tmpDir = fs.mkdtempSync(join(os.tmpdir(), 'gentzen-bad-resolvers-'));
    const badFile = join(tmpDir, 'broken.js');
    fs.writeFileSync(badFile, 'import { nonexistent } from "totally-fake-module-abc123";\n', 'utf8');

    const scenarioPath = join(testScenariosPath, 'minimal.yaml');

    try {
        const results = await runGentzenReasoning(scenarioPath, {
            resolversPath: tmpDir
        });
        assertScenarioStructure(t, results);
        t.true(results.resolverErrors.length > 0);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('runGentzenReasoning - validate verbose with invalid scenario shows errors and warnings', async t => {
    // Create a scenario that fails validation AND has warnings
    //
    const { tmpFile, tmpDir } = createTempScenario(
        `targets: []${EOL}propositions:${EOL}  - lowercase${EOL}`
    );

    try {
        const results = await runGentzenReasoning(tmpFile, {
            customResolvers: allMockResolvers,
            validate: true,
            verbose: true
        });
        assertScenarioStructure(t, results);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('runGentzenReasoning - selectiveResolution with empty scenario catches gracefully', async t => {
    // Create an empty YAML file that parses to null
    //
    const { tmpFile, tmpDir } = createTempScenario('');

    try {
        await t.throwsAsync(async () => {
            await runGentzenReasoning(tmpFile, {
                resolversPath: testResolversPath,
                selectiveResolution: true
            });
        });
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
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