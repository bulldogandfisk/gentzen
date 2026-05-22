// yaml-loader.test.js - Unit tests for YAML loading functionality

import { join } from 'node:path';
import test from 'ava';
import { buildGentzenSystem, runFactResolvers, ScenarioAbortedError } from '../../loadFromYaml.js';
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

test('buildGentzenSystem - rejects null and non-object input', t => {
        t.throws(() => buildGentzenSystem(null), { message: /parsed scenario object/i });
        t.throws(() => buildGentzenSystem('string is not a scenario'),
            { message: /parsed scenario object/i });
});

test('buildGentzenSystem - step with malformed formula records parse_error', t => {
        const scenario = {
                targets: ['B'],
                steps: [
                        { rule: 'modusPonens', from: ['(A ∧', 'B'] }
                ]
        };
        const { system } = buildGentzenSystem(scenario, {});

        t.is(system.skippedSteps.length, 1);
        t.is(system.skippedSteps[0].reason, 'parse_error');
});

test('buildGentzenSystem - alpha step without subtype defaults to "and"', t => {
        const scenario = {
                propositions: ['A', 'B'],
                targets: ['(A ∧ B)'],
                steps: [
                        { rule: 'alpha', from: ['A', 'B'] }  // no subtype
                ]
        };
        const { system } = buildGentzenSystem(scenario, {});
        t.true(system.steps.some(s => s.origin === 'AlphaRule'));
});

test('buildGentzenSystem - doubleNegation step without subtype defaults to introduction', t => {
        const scenario = {
                propositions: ['A'],
                targets: ['~~A'],
                steps: [
                        { rule: 'doubleNegation', from: ['A'] }  // no subtype
                ]
        };
        const { system } = buildGentzenSystem(scenario, {});
        t.true(system.steps.some(s => s.ruleType === 'doubleNegIntro'));
});

test('buildGentzenSystem - scenario without targets array falls back to empty', t => {
        const scenario = { propositions: ['A'] };  // no targets
        const { targets } = buildGentzenSystem(scenario, {});
        t.deepEqual(targets, []);
});

test('ScenarioAbortedError - non-Error cause uses String(cause)', t => {
        const err = new ScenarioAbortedError('FooResolver', 'sensor unreachable');
        t.is(err.resolverName, 'FooResolver');
        t.true(err.message.includes('sensor unreachable'));
});

test('buildGentzenSystem - rule precondition failure is caught and warned', t => {
        // modusPonens requires the first input to be an implication; we feed
        // two atomic propositions, which will pass the resolution check (they
        // are declared propositions) and then trip the rule's precondition.
        //
        const scenario = {
                propositions: ['A', 'B'],
                targets: ['B'],
                steps: [
                        { rule: 'modusPonens', from: ['A', 'B'] }
                ]
        };
        // Should not throw; the rule's error is caught internally.
        //
        t.notThrows(() => buildGentzenSystem(scenario, {}));
});

test('readScenarioFile - nonexistent file rejects', async t => {
        const scenarioPath = join(testScenariosPath, 'nonexistent.yaml');

        await t.throwsAsync(
            () => readScenarioFile(scenarioPath),
            { instanceOf: Error }
        );
});
