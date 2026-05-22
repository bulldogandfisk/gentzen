// display-narrative.test.js
// Smoke tests for displayResults in narrative mode. The function only writes
// to a logger, so we capture output via a custom logger and assert the shape
// of what it emitted.
//

import test from 'ava';
import { join } from 'node:path';
import { runGentzenReasoning, displayResults } from '../../main.js';
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

test('narrative - prints all five sections with header and tally', async t => {
    const results = await runGentzenReasoning(
        join(testScenariosPath, 'all-rules.yaml'),
        { customResolvers: allMockResolvers }
    );

    const capture = captureLogger();
    displayResults(results, { mode: 'narrative', description: 'unit test smoke', logger: capture.logger });
    const all = capture.lines.join('\n');

    t.true(all.includes('Scenario:'), 'header includes Scenario:');
    t.true(all.includes('unit test smoke'), 'description is rendered');
    t.true(all.includes('Propositions'), 'propositions section');
    t.true(all.includes('Facts'), 'facts section');
    t.true(all.includes('Inference steps'), 'steps section');
    t.true(all.includes('Targets'), 'targets section');
    t.true(all.includes('Result:'), 'tally line');
});

test('narrative - distinguishes ASSUMED proposition from DERIVED rule output', t => {
    // Stub result where we know exactly which target should get which label:
    //
    //   - 'Foo' is a proposition target (derivation: 'asserted')
    //     → must render as ⚠ ASSUMED with "declared as proposition" label.
    //   - '(A ∧ B)' is a derived alpha-AND step (derivation: 'derived')
    //     → must render as ✅ PROVEN with "derived at step #N" label.
    //
    const propA = { origin: 'Proposition', ruleType: 'fact', from: [], formulas: new Set(['A']) };
    const propB = { origin: 'Proposition', ruleType: 'fact', from: [], formulas: new Set(['B']) };
    const propFoo = { origin: 'Proposition', ruleType: 'fact', from: [], formulas: new Set(['Foo']) };
    const andStep = {
        origin: 'AlphaRule',
        ruleType: 'and',
        from: [propA, propB],
        formulas: new Set(['(A ∧ B)'])
    };

    const stubResults = {
        scenarioPath: '/tmp/synthetic.yaml',
        propositions: ['A', 'B', 'Foo'],
        targets: [
            { formula: 'Foo', proven: true, derivation: 'asserted', missingFacts: [], path: [] },
            { formula: '(A ∧ B)', proven: true, derivation: 'derived', missingFacts: [], path: [] }
        ],
        summary: {
            totalTargets: 2, provenTargets: 2, assertedTargets: 1,
            availableFacts: 0, missingFacts: 0, skippedSteps: 0,
            loadedFiles: [], totalResolvers: 0
        },
        availableFacts: [],
        missingFacts: [],
        skippedSteps: [],
        factResolutions: {},
        resolverErrors: [],
        verboseInfo: null,
        system: { steps: [propFoo, andStep, propA, propB], facts: new Set() }
    };

    const capture = captureLogger();
    displayResults(stubResults, { mode: 'narrative', logger: capture.logger });

    const fooIdx = capture.lines.findIndex(l => l.includes('Foo') && l.includes('ASSUMED'));
    const andIdx = capture.lines.findIndex(l => l.includes('(A ∧ B)') && l.includes('PROVEN'));
    t.true(fooIdx >= 0, 'Foo should render as ⚠ ASSUMED, not ✅ PROVEN');
    t.true(andIdx >= 0, '(A ∧ B) should render as ✅ PROVEN');

    const fooLabel = capture.lines[fooIdx + 1] || '';
    const andLabel = capture.lines[andIdx + 1] || '';

    t.true(
        fooLabel.includes('declared as proposition'),
        `Foo should be labelled "declared as proposition", got: ${fooLabel}`
    );
    t.true(
        andLabel.includes('derived at step'),
        `(A ∧ B) should be labelled "derived at step", got: ${andLabel}`
    );
});

test('narrative - failed target with no missingFacts surfaces skipped-step section', async t => {
    const results = await runGentzenReasoning(
        join(testScenariosPath, 'missing-facts.yaml'),
        { customResolvers: allMockResolvers }
    );

    const capture = captureLogger();
    displayResults(results, { mode: 'narrative', logger: capture.logger });
    const all = capture.lines.join('\n');

    t.true(all.includes('❌ FAILED'), 'at least one failed target');
    t.true(all.includes('Skipped steps'), 'skipped-steps section is shown');
});

test('narrative - empty propositions/steps falls back to gray placeholder', t => {
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

    const capture = captureLogger();
    displayResults(stubResults, { mode: 'narrative', logger: capture.logger });
    const all = capture.lines.join('\n');

    t.true(all.includes('(none declared)'), 'propositions placeholder');
    t.true(all.includes('(no resolvers ran)'), 'facts placeholder');
    t.true(all.includes('(no derivations)'), 'steps placeholder');
    t.true(all.includes('0/0 targets proven'), 'zero-tally rendered');
});

test('narrative - resolver errors surface in the Facts section', t => {
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

    const capture = captureLogger();
    displayResults(stubResults, { mode: 'narrative', logger: capture.logger });
    const all = capture.lines.join('\n');

    t.true(all.includes('Resolver errors'));
    t.true(all.includes('/path/to/broken.js'));
    t.true(all.includes('SyntaxError'));
});
