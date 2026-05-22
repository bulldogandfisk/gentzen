// yaml-loader.test.js - Unit tests for YAML loading functionality

import { join } from 'node:path';
import test from 'ava';
import { buildGentzenSystem, runFactResolvers } from '../../loadFromYaml.js';
import { readScenarioFile } from '../../validator.js';
import { allMockResolvers } from '../scenarios/test-resolvers/mockResolvers.js';

const testDir = import.meta.dirname;
const testScenariosPath = join(testDir, '../scenarios/test-scenarios');

async function loadAndBuild(scenarioPath, factMap = {}) {
    const scenario = await readScenarioFile(scenarioPath);
    return buildGentzenSystem(scenario, factMap);
}

test('buildGentzenSystem - minimal scenario', async t => {
        const scenarioPath = join(testScenariosPath, 'minimal.yaml');
        const factMap = await runFactResolvers(allMockResolvers);
        const { system, targets, referencedAtoms } = await loadAndBuild(scenarioPath, factMap);

        t.true(system !== null);
        t.true(Array.isArray(targets));
        t.true(targets.length > 0);
        t.true(referencedAtoms.has('UserWantsEuropeanFlight'));
        t.true(referencedAtoms.has('SimpleAction'));
});

test('buildGentzenSystem - all rules scenario', async t => {
        const scenarioPath = join(testScenariosPath, 'all-rules.yaml');
        const factMap = await runFactResolvers(allMockResolvers);
        const { system, targets, referencedAtoms } = await loadAndBuild(scenarioPath, factMap);

        t.true(system !== null);
        t.true(Array.isArray(targets));
        t.true(targets.length >= 6);
        t.true(referencedAtoms.has('UserWantsEuropeanFlight'));
        t.true(referencedAtoms.has('UserHasVisa'));
});

test('buildGentzenSystem - missing facts scenario', async t => {
        const scenarioPath = join(testScenariosPath, 'missing-facts.yaml');
        const factMap = await runFactResolvers(allMockResolvers);
        const { system, targets, referencedAtoms } = await loadAndBuild(scenarioPath, factMap);

        t.true(system !== null);
        t.true(Array.isArray(targets));
        t.true(system.skippedSteps.length > 0);
        t.true(system.missingFacts.size > 0);
        t.true(referencedAtoms.has('NonExistentFact1'));
        t.true(referencedAtoms.has('NonExistentFact2'));
});

test('buildGentzenSystem - invalid syntax handling', async t => {
        const scenarioPath = join(testScenariosPath, 'invalid-syntax.yaml');
        const factMap = await runFactResolvers(allMockResolvers);

        // This should not throw an error, but should handle invalid syntax gracefully
        const { system, targets } = await loadAndBuild(scenarioPath, factMap);

        t.true(system !== null);
        t.true(Array.isArray(targets));
});

test('buildGentzenSystem - empty fact resolvers', async t => {
        const scenarioPath = join(testScenariosPath, 'minimal.yaml');
        const { system, targets } = await loadAndBuild(scenarioPath, {});

        t.true(system !== null);
        t.true(Array.isArray(targets));
        t.true(system.missingFacts.size > 0);
});

test('runFactResolvers - function resolvers', async t => {
        const resolvers = {
            TestFact1: () => true,
            TestFact2: () => false
        };

        const factMap = await runFactResolvers(resolvers);

        t.is(factMap.TestFact1, true);
        t.is(factMap.TestFact2, false);
});

test('runFactResolvers - throwing function aborts via ScenarioAbortedError', async t => {
        const err = await t.throwsAsync(async () => {
            await runFactResolvers({
                TestFact1: () => true,
                BadFact: () => { throw new Error('Test error'); }
            });
        });
        t.is(err.name, 'ScenarioAbortedError');
        t.is(err.resolverName, 'BadFact');
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

test('buildGentzenSystem - fact resolution integration', async t => {
        const scenarioPath = join(testScenariosPath, 'minimal.yaml');
        const factMap = await runFactResolvers({
            UserWantsEuropeanFlight: () => true,
            SomeOtherFact: () => false
        });

        const { system } = await loadAndBuild(scenarioPath, factMap);

        t.true(system.isFactAvailable('UserWantsEuropeanFlight'));
        t.false(system.isFactAvailable('SomeOtherFact'));
});

test('buildGentzenSystem - step processing with available facts', async t => {
        const scenarioPath = join(testScenariosPath, 'minimal.yaml');
        const factMap = await runFactResolvers({
            UserWantsEuropeanFlight: () => true
        });

        const { system } = await loadAndBuild(scenarioPath, factMap);

        t.true(system.steps.length > 0);
        t.true(system.facts.has('UserWantsEuropeanFlight'));
});

test('readScenarioFile - nonexistent file rejects', async t => {
        const scenarioPath = join(testScenariosPath, 'nonexistent.yaml');

        await t.throwsAsync(
            () => readScenarioFile(scenarioPath),
            { instanceOf: Error }
        );
});
