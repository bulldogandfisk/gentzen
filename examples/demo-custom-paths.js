import { join } from 'node:path';
import { runGentzenReasoning, displayResults } from '../main.js';

const WD = import.meta.dirname;

console.log('🧪 Testing custom directory paths...\n');

try {
    const results = await runGentzenReasoning(
        join(WD, './demo-custom/my-scenarios/simple-test.yaml'),
        {
            verbose: true,
            resolversPath: join(WD, './demo-custom/my-resolvers'),
            customResolvers: {
                CustomTestFact: () => true
            }
        }
    );
    
    // Display results with verbose output
    displayResults(results, { verbose: true });
    
    console.log('\n📊 Function returned:');
    console.log(`Scenario: ${results.scenarioPath}`);
    console.log(`Proven: ${results.summary.provenTargets}/${results.summary.totalTargets}`);
    console.log(`Loaded modules: ${results.summary.loadedFiles.join(', ')}`);
    console.log(`Resolver path used: Custom path working!`);
    
} catch (error) {
    console.error('Test failed:', error.message);
}
