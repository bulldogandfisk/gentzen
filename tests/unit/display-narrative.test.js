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

// Aborted-result rendering — concise mode (default).
//
test('concise - aborted result emits SCENARIO ABORTED via logger.error', t => {
    const aborted = {
        aborted: true,
        reason: 'resolver_error',
        resolverName: 'BadResolver',
        cause: 'Sensor offline',
        scenarioPath: '/tmp/synthetic.yaml'
    };
    const capture = captureLogger();
    displayResults(aborted, { logger: capture.logger });
    const all = capture.lines.join('\n');
    t.true(all.includes('Scenario: synthetic.yaml'));
    t.true(all.includes('SCENARIO ABORTED'));
    t.true(all.includes('BadResolver'));
    t.true(all.includes('Sensor offline'));
});

test('narrative - aborted result emits bar+description+abort block', t => {
    const aborted = {
        aborted: true,
        reason: 'resolver_error',
        resolverName: 'BadResolver',
        cause: 'Sensor offline',
        scenarioPath: '/tmp/synthetic.yaml'
    };
    const capture = captureLogger();
    displayResults(aborted, {
        mode: 'narrative',
        description: 'unit test abort',
        logger: capture.logger
    });
    const all = capture.lines.join('\n');
    t.true(all.includes('Scenario:'));
    t.true(all.includes('unit test abort'));
    t.true(all.includes('SCENARIO ABORTED'));
    t.true(all.includes('BadResolver'));
    t.true(all.includes('Sensor offline'));
});

// ruleLabel: hit every origin including the synthetic-unknown default arm.
//
test('narrative - ruleLabel renders a label for every rule origin', t => {
    const mk = (origin, ruleType, formula) => ({
        origin, ruleType, from: [], formulas: new Set([formula])
    });
    const steps = [
        mk('AlphaRule', 'and', '(A ∧ B)'),
        mk('BetaRule', 'or', '(A ∨ B)'),
        mk('ContrapositionRule', 'contraposition', '(~B → ~A)'),
        mk('DoubleNegationRule', 'doubleNegIntro', '~~A'),
        mk('DoubleNegationRule', 'doubleNegElim', 'A'),
        mk('ModusPonensRule', 'modusPonens', 'B'),
        mk('ModusTollensRule', 'modusTollens', '~A'),
        mk('DisjunctiveModusPonensRule', 'disjunctiveMP', 'C'),
        mk('DisjunctiveSyllogismRule', 'disjunctiveSyllogism', 'B'),
        mk('AndEliminationRule', 'andElimL', 'A'),
        mk('AndEliminationRule', 'andElimR', 'B'),
        mk('OrEliminationRule', 'orElim', 'C'),
        mk('SyntheticUnknownOrigin', 'whatever', 'X')
    ];
    const stub = {
        scenarioPath: '/tmp/synthetic.yaml',
        propositions: [],
        targets: [],
        availableFacts: [],
        missingFacts: [],
        skippedSteps: [],
        factResolutions: {},
        resolverErrors: [],
        verboseInfo: null,
        summary: { totalTargets: 0, provenTargets: 0, availableFacts: 0, missingFacts: 0, skippedSteps: 0, loadedFiles: [], totalResolvers: 0 },
        system: { steps, facts: new Set() }
    };
    const capture = captureLogger();
    displayResults(stub, { mode: 'narrative', logger: capture.logger });
    const all = capture.lines.join('\n');

    for (const label of [
        'alpha-AND', 'beta-OR', 'contraposition',
        'doubleNeg-intro', 'doubleNeg-elim',
        'modus-ponens', 'modus-tollens',
        'disj-MP', 'disj-syll',
        'andElim-L', 'andElim-R', 'orElim',
        'SyntheticUnknownOrigin'
    ]) {
        t.true(all.includes(label), `expected label "${label}" in narrative output`);
    }
});

// derivationLabel - inference derivation with multi-step path.
//
test('narrative - inference target with 3-step path labels as "via proof search (3 steps)"', t => {
    const stub = {
        scenarioPath: '/tmp/synthetic.yaml',
        propositions: [],
        targets: [{
            formula: 'Z',
            proven: true,
            derivation: 'inference',
            missingFacts: [],
            path: [
                { rule: 'modusPonens', premises: ['(A → B)', 'A'], conclusion: 'B', sources: [] },
                { rule: 'modusPonens', premises: ['(B → C)', 'B'], conclusion: 'C', sources: [] },
                { rule: 'modusPonens', premises: ['(C → Z)', 'C'], conclusion: 'Z', sources: [] }
            ]
        }],
        availableFacts: [], missingFacts: [], skippedSteps: [],
        factResolutions: {}, resolverErrors: [], verboseInfo: null,
        summary: { totalTargets: 1, provenTargets: 1, availableFacts: 0, missingFacts: 0, skippedSteps: 0, loadedFiles: [], totalResolvers: 0 },
        system: { steps: [], facts: new Set() }
    };
    const capture = captureLogger();
    displayResults(stub, { mode: 'narrative', logger: capture.logger });
    const all = capture.lines.join('\n');
    t.true(all.includes('via proof search (3 steps)'));
});

test('narrative - inference target with empty path labels as "via proof search"', t => {
    const stub = {
        scenarioPath: '/tmp/synthetic.yaml',
        propositions: [],
        targets: [{
            formula: 'Z',
            proven: true,
            derivation: 'inference',
            missingFacts: [],
            path: []
        }],
        availableFacts: [], missingFacts: [], skippedSteps: [],
        factResolutions: {}, resolverErrors: [], verboseInfo: null,
        summary: { totalTargets: 1, provenTargets: 1, availableFacts: 0, missingFacts: 0, skippedSteps: 0, loadedFiles: [], totalResolvers: 0 },
        system: { steps: [], facts: new Set() }
    };
    const capture = captureLogger();
    displayResults(stub, { mode: 'narrative', logger: capture.logger });
    const all = capture.lines.join('\n');
    t.true(all.includes('via proof search'));
    t.false(all.includes('(0 step'));
});

// derivationLabel - derived target with a malformed target.formula falls
// through to the outer catch and returns the "derived during YAML step
// execution" label.
//
test('narrative - derived target with malformed formula falls back to YAML-step label', t => {
    const stub = {
        scenarioPath: '/tmp/synthetic.yaml',
        propositions: [],
        targets: [{
            formula: '(unparseable ∧',
            proven: true,
            derivation: 'derived',
            missingFacts: [],
            path: []
        }],
        availableFacts: [], missingFacts: [], skippedSteps: [],
        factResolutions: {}, resolverErrors: [], verboseInfo: null,
        summary: { totalTargets: 1, provenTargets: 1, availableFacts: 0, missingFacts: 0, skippedSteps: 0, loadedFiles: [], totalResolvers: 0 },
        system: { steps: [{ origin: 'Proposition', ruleType: 'fact', from: [], formulas: new Set(['A']) }], facts: new Set() }
    };
    const capture = captureLogger();
    displayResults(stub, { mode: 'narrative', logger: capture.logger });
    const all = capture.lines.join('\n');
    t.true(all.includes('derived during YAML step execution'));
});

// derivationLabel - derived target where the matching step has a malformed
// formula alongside a valid one. The inner try/catch must skip the bad
// formula and continue the search.
//
test('narrative - derived target tolerates malformed formula inside a step', t => {
    const stub = {
        scenarioPath: '/tmp/synthetic.yaml',
        propositions: [],
        targets: [{
            formula: 'Z',
            proven: true,
            derivation: 'derived',
            missingFacts: [],
            path: []
        }],
        availableFacts: [], missingFacts: [], skippedSteps: [],
        factResolutions: {}, resolverErrors: [], verboseInfo: null,
        summary: { totalTargets: 1, provenTargets: 1, availableFacts: 0, missingFacts: 0, skippedSteps: 0, loadedFiles: [], totalResolvers: 0 },
        system: {
            steps: [
                { origin: 'ModusPonensRule', ruleType: 'modusPonens', from: [], formulas: new Set(['(bad ∧', 'Z']) }
            ],
            facts: new Set()
        }
    };
    const capture = captureLogger();
    displayResults(stub, { mode: 'narrative', logger: capture.logger });
    const all = capture.lines.join('\n');
    t.true(all.includes('derived at step #1'));
});

// derivationLabel - derived target whose formula does NOT match any step.
//
test('narrative - derived target with no matching step falls back to YAML-step label', t => {
    const stub = {
        scenarioPath: '/tmp/synthetic.yaml',
        propositions: [],
        targets: [{
            formula: 'NotInSystem',
            proven: true,
            derivation: 'derived',
            missingFacts: [],
            path: []
        }],
        availableFacts: [], missingFacts: [], skippedSteps: [],
        factResolutions: {}, resolverErrors: [], verboseInfo: null,
        summary: { totalTargets: 1, provenTargets: 1, availableFacts: 0, missingFacts: 0, skippedSteps: 0, loadedFiles: [], totalResolvers: 0 },
        system: { steps: [], facts: new Set() }
    };
    const capture = captureLogger();
    displayResults(stub, { mode: 'narrative', logger: capture.logger });
    const all = capture.lines.join('\n');
    t.true(all.includes('derived during YAML step execution'));
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
