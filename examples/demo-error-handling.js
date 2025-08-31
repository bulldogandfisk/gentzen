import { runGentzenReasoning, displayResults } from '../main.js';
import { join } from 'node:path';

const WD = import.meta.dirname;

console.log('🧪 Testing error handling scenarios...\n');

// Test 1: Non-existent scenario file
console.log('Test 1: Non-existent scenario file');
try {
    const results = await runGentzenReasoning('./non-existent-scenario.yaml');
    console.log('❌ Should have thrown error');
} catch (error) {
    console.log('✅ Correctly caught error:', error.message);
}

// Test 2: Invalid YAML syntax
console.log('\nTest 2: Invalid YAML syntax');
try {
    const results = await runGentzenReasoning(
        join(WD, '../tests/scenarios/test-scenarios/invalid-syntax.yaml')
    );
    console.log('❌ Should have thrown error');
} catch (error) {
    console.log('✅ Correctly caught error:', error.message);
}

// Test 3: Missing resolvers path
console.log('\nTest 3: Missing resolvers path');
try {
    const results = await runGentzenReasoning(
        join(WD, './scenarios/mixed-scenario.yaml'),
        { resolversPath: './non-existent-path' }
    );
    console.log('✅ Handled missing resolvers gracefully');
    console.log(`Result: ${results.summary.provenTargets}/${results.summary.totalTargets} targets proven`);
} catch (error) {
    console.log('✅ Correctly caught error:', error.message);
}

// Test 4: Scenario with missing facts
console.log('\nTest 4: Scenario with missing facts');
try {
    const results = await runGentzenReasoning(
        join(WD, '../tests/scenarios/test-scenarios/missing-facts.yaml'),
        { resolversPath: join(WD, '../tests/scenarios/test-resolvers') }
    );
    
    console.log('✅ Handled missing facts scenario');
    console.log(`Result: ${results.summary.provenTargets}/${results.summary.totalTargets} targets proven`);
    console.log(`Missing facts: ${results.missingFacts.join(', ')}`);
    
    displayResults(results);
} catch (error) {
    console.log('❌ Unexpected error:', error.message);
}