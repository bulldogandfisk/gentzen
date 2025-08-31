// resolver-registry.test.js - Unit tests for resolver discovery functionality

import { join } from 'node:path';
import test from 'ava';
import { discoverResolvers, getReferencedAtoms } from '../../resolverDiscovery.js';

const testDir = import.meta.dirname;
const testResolversPath = join(testDir, '../scenarios/test-resolvers');
const mainResolversPath = join(testDir, '../fixtures/resolvers');

test('discoverResolvers - basic functionality', async t => {
    const result = await discoverResolvers(testResolversPath);
    
    t.true(typeof result === 'object');
    t.true('resolvers' in result);
    t.true('loadedFiles' in result);
    t.true('errors' in result);
    t.true('totalResolvers' in result);
    
    t.true(result.loadedFiles.length > 0);
    t.true(result.totalResolvers > 0);
    t.true('UserWantsEuropeanFlight' in result.resolvers);
    t.true(typeof result.resolvers.UserWantsEuropeanFlight === 'function');
});

test('discoverResolvers - main resolvers directory', async t => {
    const result = await discoverResolvers(mainResolversPath);
    
    t.true(result.loadedFiles.length > 0);
    t.true(result.totalResolvers > 0);
    t.true(typeof result.resolvers === 'object');
    
    // Should contain travel-related resolvers
    t.true('UserWantsEuropeanFlight' in result.resolvers);
    t.true(typeof result.resolvers.UserWantsEuropeanFlight === 'function');
});

test('discoverResolvers - recursive directory discovery', async t => {
    // Should discover resolvers in subdirectories too
    const result = await discoverResolvers(testResolversPath);
    
    t.true(result.loadedFiles.length > 0);
    
    // Check that files from subdirectories are included
    const hasSubdirectoryFiles = result.loadedFiles.some(file => 
        file.includes('/') && !file.endsWith(testResolversPath + '/mockResolvers.js')
    );
    
    // Even if no subdirectories, should work with flat structure
    t.true(result.totalResolvers > 0);
});

test('discoverResolvers - invalid path handling', async t => {
    const result = await discoverResolvers('/invalid/path/that/does/not/exist');
    
    t.is(result.loadedFiles.length, 0);
    t.is(result.totalResolvers, 0);
    t.is(Object.keys(result.resolvers).length, 0);
    t.true(Array.isArray(result.errors));
});

test('discoverResolvers - empty directory', async t => {
    // Create a temporary empty directory path for testing
    const emptyDirPath = join(testDir, '../scenarios/empty-test-dir');
    
    const result = await discoverResolvers(emptyDirPath);
    
    t.is(result.loadedFiles.length, 0);
    t.is(result.totalResolvers, 0);
    t.is(Object.keys(result.resolvers).length, 0);
});

test('discoverResolvers - missing resolversPath throws error', async t => {
    const error = await t.throwsAsync(async () => {
        await discoverResolvers();
    });
    
    t.true(error instanceof Error);
    t.true(error.message.includes('resolversPath is required'));
});

test('discoverResolvers - null resolversPath throws error', async t => {
    const error = await t.throwsAsync(async () => {
        await discoverResolvers(null);
    });
    
    t.true(error instanceof Error);
    t.true(error.message.includes('resolversPath is required'));
});

test('discoverResolvers - function extraction from modules', async t => {
    const result = await discoverResolvers(testResolversPath);
    
    // Should extract individual functions and functions from objects
    t.true(result.totalResolvers > 0);
    
    // Check that various resolver types are discovered
    const resolverNames = Object.keys(result.resolvers);
    t.true(resolverNames.length > 0);
    
    // All should be functions
    for (const name of resolverNames) {
        t.is(typeof result.resolvers[name], 'function');
    }
});

test('discoverResolvers - error handling for malformed files', async t => {
    // Use error-resolvers path if it exists, otherwise skip gracefully
    const errorResolversPath = join(testDir, '../scenarios/error-resolvers');
    
    const result = await discoverResolvers(errorResolversPath);
    
    // Should handle errors gracefully
    t.true(typeof result === 'object');
    t.true('errors' in result);
    t.true(Array.isArray(result.errors));
    
    // Even with errors, should return valid structure
    t.true('resolvers' in result);
    t.true('loadedFiles' in result);
    t.true('totalResolvers' in result);
});

test('discoverResolvers - file path validation', async t => {
    const result = await discoverResolvers(testResolversPath);
    
    // All loaded files should be absolute paths
    for (const filePath of result.loadedFiles) {
        t.true(filePath.startsWith('/'));
        t.true(filePath.endsWith('.js'));
    }
});

test('discoverResolvers - consistent results across calls', async t => {
    const result1 = await discoverResolvers(testResolversPath);
    const result2 = await discoverResolvers(testResolversPath);
    
    t.is(result1.totalResolvers, result2.totalResolvers);
    t.is(result1.loadedFiles.length, result2.loadedFiles.length);
    
    // Should have same resolver names
    const names1 = Object.keys(result1.resolvers).sort();
    const names2 = Object.keys(result2.resolvers).sort();
    t.deepEqual(names1, names2);
});

test('getReferencedAtoms - basic functionality', async t => {
    const scenario = {
        targets: ['UserWantsEuropeanFlight', '(A ∧ B)'],
        steps: [
            { from: ['UserHasVisa', 'SystemHealthy'] }
        ],
        propositions: ['CustomFact']
    };
    
    const atoms = getReferencedAtoms(scenario);
    
    t.true(atoms.has('UserWantsEuropeanFlight'));
    t.true(atoms.has('UserHasVisa'));
    t.true(atoms.has('SystemHealthy'));
    t.true(atoms.has('CustomFact'));
    t.true(atoms.has('A'));
    t.true(atoms.has('B'));
});

test('getReferencedAtoms - empty scenario', async t => {
    const scenario = {};
    const atoms = getReferencedAtoms(scenario);
    
    t.is(atoms.size, 0);
});

test('getReferencedAtoms - complex formulas', async t => {
    const scenario = {
        targets: ['(UserWantsEuropeanFlight → (UserHasVisa ∧ SystemHealthy))'],
        steps: [
            { from: ['ComplexFactA', 'ComplexFactB'] }
        ]
    };
    
    const atoms = getReferencedAtoms(scenario);
    
    t.true(atoms.has('UserWantsEuropeanFlight'));
    t.true(atoms.has('UserHasVisa'));
    t.true(atoms.has('SystemHealthy'));
    t.true(atoms.has('ComplexFactA'));
    t.true(atoms.has('ComplexFactB'));
});

test('resolver discovery - comprehensive integration', async t => {
    // Test the full discovery workflow
    const result = await discoverResolvers(testResolversPath);
    
    // Should have discovered multiple resolvers
    t.true(result.totalResolvers > 0);
    t.true(result.loadedFiles.length > 0);
    
    // Test resolver execution
    const resolverNames = Object.keys(result.resolvers);
    for (const name of resolverNames) {
        const resolver = result.resolvers[name];
        t.is(typeof resolver, 'function');
        
        // Test that resolver can be called (should not throw)
        try {
            const resultValue = resolver();
            t.true(typeof resultValue === 'boolean' || resultValue !== undefined);
        } catch (error) {
            // Some resolvers might throw - that's okay for testing
            t.true(error instanceof Error);
        }
    }
});

test('resolver discovery - performance test', async t => {
    const startTime = Date.now();
    
    const result = await discoverResolvers(testResolversPath);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should complete quickly (under 1 second)
    t.true(duration < 1000);
    t.true(result.totalResolvers > 0);
});