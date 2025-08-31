// yaml-loader.test.js - Unit tests for YAML loading functionality

import { join } from 'node:path';
import test from 'ava';
import { loadGentzenScenario, runFactResolvers } from '../../loadFromYaml.js';
import { allMockResolvers } from '../scenarios/test-resolvers/mockResolvers.js';

const testDir = import.meta.dirname;
const testScenariosPath = join(testDir, '../scenarios/test-scenarios');

test('loadGentzenScenario - minimal scenario', async t => {
        const scenarioPath = join(testScenariosPath, 'minimal.yaml');
        const { system, targets, referencedAtoms } = await loadGentzenScenario(scenarioPath, allMockResolvers);
        
        t.true(system !== null);
        t.true(Array.isArray(targets));
        t.true(targets.length > 0);
        t.true(referencedAtoms.has('UserWantsEuropeanFlight'));
        t.true(referencedAtoms.has('SimpleAction'));
});

test('loadGentzenScenario - all rules scenario', async t => {
        const scenarioPath = join(testScenariosPath, 'all-rules.yaml');
        const { system, targets, referencedAtoms } = await loadGentzenScenario(scenarioPath, allMockResolvers);
        
        t.true(system !== null);
        t.true(Array.isArray(targets));
        t.true(targets.length >= 6); // We have 6 targets in all-rules.yaml
        t.true(referencedAtoms.has('UserWantsEuropeanFlight'));
        t.true(referencedAtoms.has('UserHasVisa'));
});

test('loadGentzenScenario - missing facts scenario', async t => {
        const scenarioPath = join(testScenariosPath, 'missing-facts.yaml');
        const { system, targets, referencedAtoms } = await loadGentzenScenario(scenarioPath, allMockResolvers);
        
        t.true(system !== null);
        t.true(Array.isArray(targets));
        t.true(system.skippedSteps.length > 0);
        t.true(system.missingFacts.size > 0);
        t.true(referencedAtoms.has('NonExistentFact1'));
        t.true(referencedAtoms.has('NonExistentFact2'));
});

test('loadGentzenScenario - invalid syntax handling', async t => {
        const scenarioPath = join(testScenariosPath, 'invalid-syntax.yaml');
        
        // This should not throw an error, but should handle invalid syntax gracefully
        const { system, targets } = await loadGentzenScenario(scenarioPath, allMockResolvers);
        
        t.true(system !== null);
        t.true(Array.isArray(targets));
        // Invalid steps should be skipped, not crash the system
});

test('loadGentzenScenario - empty fact resolvers', async t => {
        const scenarioPath = join(testScenariosPath, 'minimal.yaml');
        const { system, targets } = await loadGentzenScenario(scenarioPath, {});
        
        t.true(system !== null);
        t.true(Array.isArray(targets));
        t.true(system.missingFacts.size > 0);
});

test('runFactResolvers - function resolvers', async t => {
        const resolvers = {
            TestFact1: () => true,
            TestFact2: () => false,
            TestFact3: () => { throw new Error('Test error'); }
        };
        
        const factMap = await runFactResolvers(resolvers);
        
        t.is(factMap.TestFact1, true);
        t.is(factMap.TestFact2, false);
        t.is(factMap.TestFact3, false); // Should be false due to error
});

test('runFactResolvers - non-function resolvers', async t => {
        const resolvers = {
            TestFact1: true,
            TestFact2: false,
            TestFact3: 'truthy string',
            TestFact4: '',
            TestFact5: 0,
            TestFact6: 1
        };
        
        const factMap = await runFactResolvers(resolvers);
        
        t.is(factMap.TestFact1, true);
        t.is(factMap.TestFact2, false);
        t.is(factMap.TestFact3, true);
        t.is(factMap.TestFact4, false);
        t.is(factMap.TestFact5, false);
        t.is(factMap.TestFact6, true);
});

test('runFactResolvers - empty resolvers', async t => {
        const factMap = await runFactResolvers({});
        
        t.is(Object.keys(factMap).length, 0);
});

test('loadGentzenScenario - fact resolution integration', async t => {
        const scenarioPath = join(testScenariosPath, 'minimal.yaml');
        const factResolvers = {
            UserWantsEuropeanFlight: () => true,
            SomeOtherFact: () => false
        };
        
        const { system } = await loadGentzenScenario(scenarioPath, factResolvers);
        
        t.true(system.isFactAvailable('UserWantsEuropeanFlight'));
        t.false(system.isFactAvailable('SomeOtherFact'));
});

test('loadGentzenScenario - step processing with available facts', async t => {
        const scenarioPath = join(testScenariosPath, 'minimal.yaml');
        const factResolvers = {
            UserWantsEuropeanFlight: () => true
        };
        
        const { system } = await loadGentzenScenario(scenarioPath, factResolvers);
        
        t.true(system.steps.length > 0);
        t.true(system.facts.has('UserWantsEuropeanFlight'));
});

test('loadGentzenScenario - nonexistent file', async t => {
        const scenarioPath = join(testScenariosPath, 'nonexistent.yaml');
        
        await t.throwsAsync(
            async () => await loadGentzenScenario(scenarioPath, {}),
            { instanceOf: Error }
        );
});