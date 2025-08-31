import { runGentzenReasoning, displayResults } from '../main.js';
import { join } from 'node:path';

const WD = import.meta.dirname;

console.log('🧪 Testing separated reasoning and display functions...\n');

try {
    // Run reasoning with verbose to capture detailed info and explicit resolver path
    const results = await runGentzenReasoning(
        join(WD, './scenarios/mixed-scenario.yaml'), 
        { 
            verbose: true,
            resolversPath: join(WD, './resolvers')
        }
    );
    
    // Display results with verbose output (now includes enhanced detail)
    displayResults(results, { verbose: true });
    
} catch (error) {
    console.error('Test failed:', error.message);
}
