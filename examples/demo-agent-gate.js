// demo-agent-gate.js
//
// Gating an agent action behind a Gentzen proof.
//
// An agent wants to call a tool (here: ProcessOrder). Before letting the call
// go through, the engine must prove every declared target. If every target
// closes, the action executes. If any fails, the gate refuses — and the
// narrative output explains exactly which precondition was missing.
//

import { join } from 'node:path';
import { runGentzenReasoning, displayResults } from '../main.js';
import { updateConfig } from '../utilities/config.js';
import { LogLevel } from '../utilities/logger.js';

updateConfig({ logging: { level: LogLevel.WARN } });

const WD = import.meta.dirname;
const scenarioPath = join(WD, './scenarios/mixed-scenario.yaml');

// Stub for the action the agent wants to take. In a real system this is
// the LLM tool call, the database write, the outbound notification, etc.
//
async function executeAction(name) {
    console.log(`   [tool-call] ${name}`);
}

async function gatedRun(actionName, customResolvers, description) {
    const results = await runGentzenReasoning(scenarioPath, { customResolvers });
    displayResults(results, { mode: 'narrative', description });

    const allowed = results.summary.provenTargets === results.summary.totalTargets;
    if (allowed) {
        console.log(`Decision: ALLOW — running ${actionName}`);
        await executeAction(actionName);
    } else {
        console.log(`Decision: BLOCK — ${actionName} refused`);
    }
    return allowed;
}

// Run 1: every fact resolves true. Expect ALLOW.
//
const allTrueResolvers = {
    CustomerIsVIP: () => true,
    PaymentProcessed: () => true,
    SystemHealthy: () => true,
    IsBusinessHours: () => true
};
const allowed1 = await gatedRun('ProcessOrder', allTrueResolvers,
    'Run 1: every precondition holds — gate should allow.');

// Run 2: PaymentProcessed resolves false. Expect BLOCK.
//
const paymentFailingResolvers = {
    CustomerIsVIP: () => true,
    PaymentProcessed: () => false,
    SystemHealthy: () => true,
    IsBusinessHours: () => true
};
const allowed2 = await gatedRun('ProcessOrder', paymentFailingResolvers,
    'Run 2: payment did not process — gate should block, with reasons.');

console.log(`\nGate behaviour: allow=${allowed1}, block=${!allowed2}`);
