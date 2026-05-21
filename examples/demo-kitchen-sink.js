import { join } from 'node:path';
import { runGentzenReasoning, displayStory } from '../main.js';
import { updateConfig } from '../utilities/config.js';
import { LogLevel } from '../utilities/logger.js';
import { enterpriseResolvers } from './resolvers/enterpriseResolvers.js';

updateConfig({ logging: { level: LogLevel.WARN } });

const WD = import.meta.dirname;

// The kitchen-sink scenario exercises every inference rule (alpha-AND,
// alpha-IMPLIES, beta-OR, contraposition, double-negation, equivalence)
// inside a realistic enterprise control flow: customer verification,
// payment processing, fraud detection, system health, and compliance.
//
const results = await runGentzenReasoning(
    join(WD, 'scenarios', 'enterprise-kitchen-sink.yaml'),
    { customResolvers: enterpriseResolvers }
);

displayStory(results, {
    description: 'Every logical rule in one enterprise scenario.'
});

// Surface a few business-level outcomes the scenario is designed to decide.
//
const keyOutcomes = [
    'ProcessOrder',
    'RequireManualReview',
    'ApplyFraudHold',
    'InitiateAMLCheck',
    'ScaleInfrastructure'
];

console.log('Key business outcomes');
for (const outcome of keyOutcomes) {
    const target = results.targets.find(t => t.formula === outcome);
    if (!target) {
        console.log(`  ${outcome}: (not declared as a target in this scenario)`);
        continue;
    }
    console.log(`  ${target.proven ? '✓' : '✗'} ${outcome}`);
}
