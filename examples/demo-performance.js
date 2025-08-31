import { runGentzenReasoning, displayResults } from '../main.js';
import { join } from 'node:path';

const WD = import.meta.dirname;

console.log('🧪 Testing performance and timing...\n');

async function timeExecution(label, asyncFn) {
    const start = performance.now();
    const result = await asyncFn();
    const end = performance.now();
    console.log(`⏱️  ${label}: ${(end - start).toFixed(2)}ms`);
    return result;
}

try {
    // Test 1: Basic scenario timing
    console.log('Test 1: Basic scenario performance');
    const results1 = await timeExecution('Basic scenario', () =>
        runGentzenReasoning(
            join(WD, './scenarios/mixed-scenario.yaml'),
            { resolversPath: join(WD, './resolvers') }
        )
    );
    
    console.log(`Result: ${results1.summary.provenTargets}/${results1.summary.totalTargets} targets`);
    console.log(`Facts: ${results1.summary.availableFacts} available, ${results1.summary.missingFacts} missing`);
    
    // Test 2: Verbose mode timing
    console.log('\nTest 2: Verbose mode performance');
    const results2 = await timeExecution('Verbose mode', () =>
        runGentzenReasoning(
            join(WD, './scenarios/mixed-scenario.yaml'),
            { 
                resolversPath: join(WD, './resolvers'),
                verbose: true
            }
        )
    );
    
    console.log(`Result: ${results2.summary.provenTargets}/${results2.summary.totalTargets} targets`);
    
    // Test 3: Display timing
    console.log('\nTest 3: Display performance');
    await timeExecution('Display results', () => {
        displayResults(results2);
        return Promise.resolve();
    });
    
    // Test 4: Multiple runs for consistency
    console.log('\nTest 4: Multiple runs for consistency');
    const times = [];
    for (let i = 0; i < 5; i++) {
        const start = performance.now();
        await runGentzenReasoning(
            join(WD, './scenarios/mixed-scenario.yaml'),
            { resolversPath: join(WD, './resolvers') }
        );
        const end = performance.now();
        times.push(end - start);
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log(`📊 5 runs: avg=${avgTime.toFixed(2)}ms, min=${minTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`);
    
} catch (error) {
    console.error('Performance test failed:', error.message);
}