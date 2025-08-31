import { runGentzenReasoning, displayResults } from '../main.js';
import { join } from 'node:path';

const WD = import.meta.dirname;

console.log('🧪 Testing batch processing of multiple scenarios...\n');

async function processScenarios() {
    const scenarios = [
        {
            name: 'Mixed Scenario',
            path: join(WD, './scenarios/mixed-scenario.yaml'),
            resolversPath: join(WD, './resolvers')
        },
        {
            name: 'No Facts Scenario',
            path: join(WD, './scenarios/scenario-no-facts.yaml'),
            resolversPath: null
        },
        {
            name: 'System Scenario',
            path: join(WD, './scenarios/system-scenario.yaml'),
            resolversPath: join(WD, './resolvers')
        }
    ];
    
    const results = [];
    
    for (const scenario of scenarios) {
        console.log(`\n📋 Processing: ${scenario.name}`);
        
        try {
            const options = scenario.resolversPath ? { resolversPath: scenario.resolversPath } : {};
            const result = await runGentzenReasoning(scenario.path, options);
            
            console.log(`✅ ${scenario.name}: ${result.summary.provenTargets}/${result.summary.totalTargets} targets proven`);
            
            results.push({
                name: scenario.name,
                success: true,
                result: result,
                error: null
            });
            
        } catch (error) {
            console.log(`❌ ${scenario.name}: Error - ${error.message}`);
            
            results.push({
                name: scenario.name,
                success: false,
                result: null,
                error: error.message
            });
        }
    }
    
    return results;
}

try {
    const batchResults = await processScenarios();
    
    console.log('\n📊 Batch Processing Summary:');
    console.log('='.repeat(50));
    
    let totalScenarios = batchResults.length;
    let successfulScenarios = 0;
    let totalTargets = 0;
    let totalProven = 0;
    
    for (const batch of batchResults) {
        if (batch.success) {
            successfulScenarios++;
            totalTargets += batch.result.summary.totalTargets;
            totalProven += batch.result.summary.provenTargets;
            
            console.log(`✅ ${batch.name}:`);
            console.log(`   Targets: ${batch.result.summary.provenTargets}/${batch.result.summary.totalTargets}`);
            console.log(`   Facts: ${batch.result.summary.availableFacts} available, ${batch.result.summary.missingFacts} missing`);
        } else {
            console.log(`❌ ${batch.name}: ${batch.error}`);
        }
    }
    
    console.log('\n🎯 Overall Statistics:');
    console.log(`Scenarios processed: ${successfulScenarios}/${totalScenarios}`);
    console.log(`Total targets proven: ${totalProven}/${totalTargets}`);
    console.log(`Success rate: ${((totalProven / totalTargets) * 100).toFixed(1)}%`);
    
    // Show detailed results for successful scenarios
    console.log('\n📋 Detailed Results:');
    for (const batch of batchResults) {
        if (batch.success) {
            console.log(`\n--- ${batch.name} ---`);
            displayResults(batch.result);
        }
    }
    
} catch (error) {
    console.error('Batch processing failed:', error.message);
}