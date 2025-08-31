import { runGentzenReasoning, displayResults } from '../main.js';
import { join } from 'node:path';

const WD = import.meta.dirname;

console.log('🧪 Testing inline custom resolvers...\n');

try {
    // Define custom resolvers inline
    const customResolvers = {
        // Business logic resolvers
        IsBusinessDay: () => {
            const today = new Date();
            const dayOfWeek = today.getDay();
            return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
        },
        
        IsWorkingHours: () => {
            const now = new Date();
            const hour = now.getHours();
            return hour >= 9 && hour <= 17; // 9 AM to 5 PM
        },
        
        // System status resolvers
        DatabaseConnected: () => true, // Mock: assume connected
        ServicesHealthy: () => true,    // Mock: assume healthy
        
        // Dynamic fact resolver
        CurrentTemperature: () => 22,   // Mock: 22°C
        
        // Complex logic resolver
        ShouldProcessPayments: () => {
            const isBusinessDay = customResolvers.IsBusinessDay();
            const isWorkingHours = customResolvers.IsWorkingHours();
            const servicesHealthy = customResolvers.ServicesHealthy();
            return isBusinessDay && isWorkingHours && servicesHealthy;
        }
    };
    
    console.log('📋 Custom resolvers defined:');
    Object.keys(customResolvers).forEach(name => {
        console.log(`  - ${name}`);
    });
    
    const results = await runGentzenReasoning(
        join(WD, './scenarios/mixed-scenario.yaml'),
        { 
            customResolvers,
            verbose: true
        }
    );
    
    console.log('\n✅ Reasoning completed with inline resolvers!');
    console.log(`📊 Results: ${results.summary.provenTargets}/${results.summary.totalTargets} targets proven`);
    
    displayResults(results, { verbose: true });
    
    console.log('\n🔍 Resolver Analysis:');
    console.log('Custom resolver results:');
    Object.entries(customResolvers).forEach(([name, resolver]) => {
        try {
            const result = resolver();
            console.log(`  ✅ ${name}: ${result}`);
        } catch (error) {
            console.log(`  ❌ ${name}: Error - ${error.message}`);
        }
    });
    
} catch (error) {
    console.error('Test failed:', error.message);
}