import test from 'ava';
import { runGentzenReasoning } from '../../main.js';
import { join } from 'node:path';

const testScenariosPath = join(import.meta.dirname, '../scenarios/test-scenarios');

function assertProven(t, target, results) {
    const targetResult = results.targets.find(r => r.formula === target);
    t.truthy(targetResult, `Target "${target}" not found in results`);
    t.true(targetResult.proven, `Target "${target}" was not proven. Missing: ${targetResult.missingFacts.join(', ')}`);
}

function assertNotProven(t, target, results) {
    const targetResult = results.targets.find(r => r.formula === target);
    t.truthy(targetResult, `Target "${target}" not found in results`);
    t.false(targetResult.proven, `Target "${target}" should not be proven but was`);
}

test('auto-negation - complete scenario integration', async t => {
    const scenarioPath = join(testScenariosPath, 'auto-negation.yaml');
    
    // Resolvers that test auto-negation
    const resolvers = {
        // Should auto-generate ~UserHasPermission
        UserHasPermission: () => false,
        
        // Should be available as positive facts
        SecurityEnabled: () => true,
        AdminLoggedIn: () => true,
        SystemOnline: () => true,
        
        // Should auto-generate ~MaintenanceMode
        MaintenanceMode: () => false,
    };
    
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: resolvers
    });
    
    // Check auto-negated facts are available
    t.true(results.availableFacts.includes('~UserHasPermission'));
    t.true(results.availableFacts.includes('~MaintenanceMode'));
    
    // Check positive facts are available
    t.true(results.availableFacts.includes('SecurityEnabled'));
    t.true(results.availableFacts.includes('AdminLoggedIn'));
    t.true(results.availableFacts.includes('SystemOnline'));
    
    // Check that false resolver facts are NOT available
    t.false(results.availableFacts.includes('UserHasPermission'));
    t.false(results.availableFacts.includes('MaintenanceMode'));
    
    // Test targets that should be proven with auto-negation
    assertProven(t, '(~UserHasPermission ∧ SecurityEnabled)', results);
    assertProven(t, 'AccessDenied', results);
    assertProven(t, '(AdminLoggedIn ∧ SystemOnline)', results);
    assertProven(t, 'AccessGranted', results);
    assertProven(t, '(SystemOnline ∧ ~MaintenanceMode)', results);
    assertProven(t, 'SystemReady', results);
    
    // Test targets that should fail (positive facts that resolved false)
    assertNotProven(t, 'UserHasPermission', results);
    assertNotProven(t, 'MaintenanceMode', results);
});

test('auto-negation - edge cases and conflicts', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    
    const resolvers = {
        // Normal case
        Feature1: () => true,
        Feature2: () => false,     // Should auto-generate ~Feature2
        
        // Edge case: explicit negated resolver
        '~Feature3': () => true,   // Should NOT auto-generate ~~Feature3
        
        // Edge case: resolver that throws
        FailingFeature: () => { throw new Error('Test error'); },  // Should auto-generate ~FailingFeature
        
        // Edge case: non-function resolver
        StaticTrue: true,
        StaticFalse: false,        // Should auto-generate ~StaticFalse
    };
    
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: resolvers
    });
    
    // Normal cases
    t.true(results.availableFacts.includes('Feature1'));
    t.true(results.availableFacts.includes('~Feature2'));
    t.false(results.availableFacts.includes('Feature2'));
    
    // Explicit negated resolver should work
    t.true(results.availableFacts.includes('~Feature3'));
    t.false(results.availableFacts.includes('~~Feature3')); // Should NOT double-negate
    
    // Failing resolver should auto-negate
    t.true(results.availableFacts.includes('~FailingFeature'));
    t.false(results.availableFacts.includes('FailingFeature'));
    
    // Static resolvers
    t.true(results.availableFacts.includes('StaticTrue'));
    t.true(results.availableFacts.includes('~StaticFalse'));
    t.false(results.availableFacts.includes('StaticFalse'));
    
    // Check fact resolutions show original results
    t.true(results.factResolutions.Feature1);
    t.false(results.factResolutions.Feature2);
    t.true(results.factResolutions['~Feature3']);
    t.false(results.factResolutions.FailingFeature);
    t.true(results.factResolutions.StaticTrue);
    t.false(results.factResolutions.StaticFalse);
});

test('auto-negation - no interference with existing scenarios', async t => {
    // Test that auto-negation doesn't break existing scenarios
    const scenarioPath = join(testScenariosPath, 'all-rules.yaml');
    
    const results = await runGentzenReasoning(scenarioPath, {
        resolversPath: join(import.meta.dirname, '../scenarios/test-resolvers')
    });
    
    // Should have auto-negated facts for false resolvers
    const hasAutoNegated = results.availableFacts.some(fact => fact.startsWith('~'));
    t.true(hasAutoNegated, 'Should have some auto-negated facts');
    
    // Should still prove the expected targets
    assertProven(t, 'ActionA', results);
    assertProven(t, '(ActionA ∨ ActionB)', results);
    assertProven(t, '~~UserHasVisa', results);
    
    // Should have some successful targets
    t.true(results.summary.provenTargets > 0, 'Should prove some targets');
});

test('auto-negation - performance with many false resolvers', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    
    // Create many false resolvers to test auto-negation performance
    const resolvers = {};
    for (let i = 0; i < 100; i++) {
        resolvers[`Feature${i}`] = () => false;  // Should all auto-negate
    }
    
    const start = performance.now();
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: resolvers
    });
    const end = performance.now();
    
    // Should complete quickly
    t.true(end - start < 1000, 'Should complete auto-negation quickly');
    
    // Should have all auto-negated facts
    for (let i = 0; i < 100; i++) {
        t.true(results.availableFacts.includes(`~Feature${i}`));
        t.false(results.availableFacts.includes(`Feature${i}`));
    }
    
    // Should track all in fact resolutions
    t.is(Object.keys(results.factResolutions).length, 100);
});