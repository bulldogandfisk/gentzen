import test from 'ava';
import { runFactResolvers } from '../../loadFromYaml.js';
import { runGentzenReasoning } from '../../main.js';
import { join } from 'node:path';

const testFixturePath = join(import.meta.dirname, '../fixtures');

// Unit tests for auto-negation in runFactResolvers
test('runFactResolvers - auto-negation for false resolvers', async t => {
    const resolvers = {
        UserIsAdmin: () => true,
        UserHasPermission: () => false,
        SystemOnline: () => true,
        MaintenanceMode: () => false,
    };
    
    const factMap = await runFactResolvers(resolvers);
    
    // Check resolver results
    t.true(factMap.UserIsAdmin);
    t.false(factMap.UserHasPermission);
    t.true(factMap.SystemOnline);
    t.false(factMap.MaintenanceMode);
});

test('runFactResolvers - no auto-negation for already negated names', async t => {
    const resolvers = {
        '~UserHasPermission': () => true,    // Explicit negated resolver
        UserIsGuest: () => false,            // Should auto-negate
    };
    
    const factMap = await runFactResolvers(resolvers);
    
    // Explicit negated resolver should work normally
    t.true(factMap['~UserHasPermission']);
    // Regular false resolver should still be false in factMap
    t.false(factMap.UserIsGuest);
});

test('runFactResolvers - mixed resolver types with auto-negation', async t => {
    const resolvers = {
        // Function resolvers
        DatabaseConnected: () => true,
        BackupRunning: () => false,
        
        // Static value resolvers
        IsProduction: true,
        IsTestMode: false,
        
        // Error resolver
        FailingCheck: () => { throw new Error('Test error'); }
    };
    
    const factMap = await runFactResolvers(resolvers);
    
    t.true(factMap.DatabaseConnected);
    t.false(factMap.BackupRunning);
    t.true(factMap.IsProduction);
    t.false(factMap.IsTestMode);
    t.false(factMap.FailingCheck);  // Errors become false
});

test('runFactResolvers - auto-negation integration with system', async t => {
    const resolvers = {
        UserHasAccess: () => false,      // Should auto-generate ~UserHasAccess
        SystemSecure: () => true,        // Should be available as SystemSecure
        InMaintenanceMode: () => false,  // Should auto-generate ~InMaintenanceMode
    };
    
    // Create a simple scenario to test integration
    const scenarioPath = join(testFixturePath, 'scenarios/scenario-no-facts.yaml');
    
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: resolvers
    });
    
    // Check that auto-negated facts are available
    t.true(results.availableFacts.includes('~UserHasAccess'));
    t.true(results.availableFacts.includes('SystemSecure'));
    t.true(results.availableFacts.includes('~InMaintenanceMode'));
    
    // Check that positive facts are NOT available
    t.false(results.availableFacts.includes('UserHasAccess'));
    t.false(results.availableFacts.includes('InMaintenanceMode'));
});

test('auto-negation - fact resolutions tracking', async t => {
    const resolvers = {
        FeatureEnabled: () => true,
        FeatureDisabled: () => false,
        ErrorResolver: () => { throw new Error('Test'); }
    };
    
    const scenarioPath = join(testFixturePath, 'scenarios/scenario-no-facts.yaml');
    
    const results = await runGentzenReasoning(scenarioPath, {
        customResolvers: resolvers
    });
    
    // Check fact resolutions show original resolver results
    t.true(results.factResolutions.FeatureEnabled);
    t.false(results.factResolutions.FeatureDisabled);
    t.false(results.factResolutions.ErrorResolver);
    
    // But check that auto-negated facts are available
    t.true(results.availableFacts.includes('FeatureEnabled'));
    t.true(results.availableFacts.includes('~FeatureDisabled'));
    t.true(results.availableFacts.includes('~ErrorResolver'));
});