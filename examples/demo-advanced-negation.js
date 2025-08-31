import { runGentzenReasoning, displayResults } from '../main.js';
import { join } from 'node:path';

const WD = import.meta.dirname;

console.log('🧪 Testing advanced negation: double negation & contraposition...\n');

try {
    // Custom resolvers for advanced negation demo
    const customResolvers = {
        UserIsAdmin: () => true,
        SystemSecure: () => true,
        DatabaseConnected: () => true,  // Used for ~~DatabaseConnected in steps
    };
    
    const results = await runGentzenReasoning(
        join(WD, './scenarios/advanced-negation.yaml'),
        { 
            customResolvers,
            verbose: true 
        }
    );
    
    console.log('✅ Advanced negation demo completed!');
    console.log(`📊 Results: ${results.summary.provenTargets}/${results.summary.totalTargets} targets proven`);
    
    displayResults(results, { verbose: true });
    
    console.log('\n🔍 Negation Examples Demonstrated:');
    console.log('1. ~~DatabaseConnected → DatabaseConnected (double negation elimination)');
    console.log('2. (UserIsAdmin → AllowAccess) → (~AllowAccess → ~UserIsAdmin) (contraposition)');
    console.log('3. Complex formulas with ~ (negation symbol)');
    
} catch (error) {
    console.error('Advanced negation demo failed:', error.message);
}