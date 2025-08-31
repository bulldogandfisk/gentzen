import { runGentzenReasoning, displayResults } from '../main.js';
import { join } from 'node:path';

const WD = import.meta.dirname;

console.log('🧪 Testing negation handling in Gentzen system...\n');

try {
    // Custom resolvers that provide facts based on system state
    const customResolvers = {
        // User state
        UserIsLoggedIn: () => true,
        UserHasPermission: () => false,     // Will auto-generate ~UserHasPermission
        UserIsGuest: () => true,
        
        // System state  
        SecurityCheckPassed: () => true,
        MaintenanceMode: () => false,       // Will auto-generate ~MaintenanceMode
        SystemIsOffline: () => false,       // Will auto-generate ~SystemIsOffline
    };
    
    console.log('📋 Custom resolvers and their values:');
    Object.entries(customResolvers).forEach(([name, resolver]) => {
        const result = resolver();
        console.log(`  ${result ? '✅' : '❌'} ${name}: ${result}`);
    });
    
    const results = await runGentzenReasoning(
        join(WD, './scenarios/negation-demo.yaml'),
        { 
            customResolvers,
            verbose: true
        }
    );
    
    console.log('\n✅ Negation demo completed!');
    console.log(`📊 Results: ${results.summary.provenTargets}/${results.summary.totalTargets} targets proven`);
    
    displayResults(results, { verbose: true });
    
} catch (error) {
    console.error('Negation demo failed:', error.message);
}