import { runGentzenReasoning, displayResults } from '../main.js';
import { join } from 'node:path';

const WD = import.meta.dirname;

console.log('🧪 Testing scenario without external resolvers...\n');

try {
    // Run with no resolvers path - should work with scenarios that don't need external facts
    const results = await runGentzenReasoning(
        join(WD, './scenarios/scenario-no-facts.yaml')
    );
    
    console.log('✅ Scenario completed without external resolvers!');
    console.log(`📊 Results: ${results.summary.provenTargets}/${results.summary.totalTargets} targets proven`);
    console.log(`📁 Scenario: ${results.scenarioPath.split('/').pop()}`);
    
    displayResults(results);
    
    console.log('\n🔍 Detailed Analysis:');
    console.log(`- Total resolvers loaded: ${results.summary.totalResolvers}`);
    console.log(`- Loaded files: ${results.summary.loadedFiles.join(', ') || 'None'}`);
    console.log(`- Available facts: ${results.summary.availableFacts}`);
    console.log(`- Missing facts: ${results.summary.missingFacts}`);
    
} catch (error) {
    console.error('Test failed:', error.message);
}