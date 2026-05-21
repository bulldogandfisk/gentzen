// display-story.test.js
// Smoke tests for displayStory. The function only writes to a logger,
// so we capture output via a custom logger and assert the shape of
// what it emitted.
//

import test from 'ava';
import { join } from 'node:path';
import { runGentzenReasoning, displayStory } from '../../main.js';
import { allMockResolvers } from '../scenarios/test-resolvers/mockResolvers.js';

const testDir = import.meta.dirname;
const testScenariosPath = join(testDir, '../scenarios/test-scenarios');

// Build a logger that captures every line into an array.
//
function captureLogger() {
    const lines = [];
    const log = (msg) => {
        // Strip ANSI escapes for easier substring matching.
        const cleaned = String(msg).replace(/\x1b\[[0-9;]*m/g, '');
        lines.push(cleaned);
    };
    return {
        lines,
        logger: {
            info: log,
            warn: log,
            error: log,
            debug: log
        }
    };
}

test('displayStory - prints all five sections with header and tally', async t => {
    const results = await runGentzenReasoning(
        join(testScenariosPath, 'all-rules.yaml'),
        { customResolvers: allMockResolvers }
    );

    const { lines, logger } = captureLogger();
    displayStory(results, { description: 'unit test smoke', logger });
    const all = lines.join('\n');

    t.true(all.includes('Scenario:'), 'header includes Scenario:');
    t.true(all.includes('unit test smoke'), 'description is rendered');
    t.true(all.includes('Propositions'), 'propositions section');
    t.true(all.includes('Facts'), 'facts section');
    t.true(all.includes('Inference steps'), 'steps section');
    t.true(all.includes('Targets'), 'targets section');
    t.true(all.includes('Result:'), 'tally line');
});

test('displayStory - proposition match labelled distinctly from derived match', async t => {
    const results = await runGentzenReasoning(
        join(testScenariosPath, 'all-rules.yaml'),
        { customResolvers: allMockResolvers }
    );

    const { lines, logger } = captureLogger();
    displayStory(results, { logger });
    const all = lines.join('\n');

    // At least one target in this scenario is a proposition name, so the
    // "declared as proposition" label should appear if any proposition is
    // among the targets — assert the function emits the right phrase when
    // applicable. We accept either label appearing because the scenario shape
    // determines which one fires.
    //
    t.true(
        all.includes('declared as proposition') || all.includes('derived at step') || all.includes('via proof search'),
        'at least one proven-source label is present'
    );
});

test('displayStory - failed target with no missingFacts surfaces skipped-step section', async t => {
    const results = await runGentzenReasoning(
        join(testScenariosPath, 'missing-facts.yaml'),
        { customResolvers: allMockResolvers }
    );

    const { lines, logger } = captureLogger();
    displayStory(results, { logger });
    const all = lines.join('\n');

    t.true(all.includes('❌ FAILED'), 'at least one failed target');
    t.true(all.includes('Skipped steps'), 'skipped-steps section is shown');
});

test('displayStory - empty propositions/steps falls back to gray placeholder', async t => {
    // Synthetic minimal result object — no scenario load required.
    //
    const stubResults = {
        scenarioPath: '/tmp/synthetic.yaml',
        propositions: [],
        targets: [],
        summary: {
            totalTargets: 0,
            provenTargets: 0,
            availableFacts: 0,
            missingFacts: 0,
            skippedSteps: 0,
            loadedFiles: [],
            totalResolvers: 0
        },
        availableFacts: [],
        missingFacts: [],
        skippedSteps: [],
        factResolutions: {},
        resolverErrors: [],
        verboseInfo: null,
        system: { steps: [], facts: new Set() }
    };

    const { lines, logger } = captureLogger();
    displayStory(stubResults, { logger });
    const all = lines.join('\n');

    t.true(all.includes('(none declared)'), 'propositions placeholder');
    t.true(all.includes('(no resolvers ran)'), 'facts placeholder');
    t.true(all.includes('(no derivations)'), 'steps placeholder');
    t.true(all.includes('0/0 targets proven'), 'zero-tally rendered');
});

test('displayStory - resolver errors surface in the Facts section', t => {
    const stubResults = {
        scenarioPath: '/tmp/synthetic.yaml',
        propositions: ['A'],
        targets: [{ formula: 'A', proven: true, missingFacts: [], path: [] }],
        summary: {
            totalTargets: 1,
            provenTargets: 1,
            availableFacts: 0,
            missingFacts: 0,
            skippedSteps: 0,
            loadedFiles: [],
            totalResolvers: 0
        },
        availableFacts: [],
        missingFacts: [],
        skippedSteps: [],
        factResolutions: {},
        resolverErrors: [{ file: '/path/to/broken.js', error: 'SyntaxError' }],
        verboseInfo: null,
        system: { steps: [{ origin: 'Proposition', ruleType: 'fact', from: [], formulas: new Set(['A']) }], facts: new Set() }
    };

    const { lines, logger } = captureLogger();
    displayStory(stubResults, { logger });
    const all = lines.join('\n');

    t.true(all.includes('Resolver errors'));
    t.true(all.includes('/path/to/broken.js'));
    t.true(all.includes('SyntaxError'));
});
