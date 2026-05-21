// soundness-negative.test.js
// Negative tests: the engine must NOT prove things it should not.
//

import test from 'ava';
import { join } from 'node:path';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { GentzenSystem } from '../../gentzen.js';
import { runGentzenReasoning } from '../../main.js';
import { clearNormalizeCache } from '../../utilities/formulaUtils.js';

test.beforeEach(() => {
    clearNormalizeCache();
});

test('Independence: from {A}, B is not derivable', t => {
    const sys = new GentzenSystem();
    sys.addProposition('A');

    const result = sys.searchForProof('B');

    t.false(result.proven, 'B is unrelated to A; engine must not prove it');
});

test('Unrelated implication: from {A, (B → C)}, C is not derivable', t => {
    const sys = new GentzenSystem();
    sys.addProposition('A');
    sys.addProposition('(B → C)');

    const result = sys.searchForProof('C');

    t.false(result.proven, 'C is the consequent of an implication whose antecedent is unavailable');
});

test('No fabricated implication: from {A, B}, (A → B) is not derivable', t => {
    const sys = new GentzenSystem();
    sys.addProposition('A');
    sys.addProposition('B');

    const result = sys.searchForProof('(A → B)');

    t.false(result.proven, 'Implication introduction is not a sound primitive in this engine');
});

test('No fabricated equivalence: from {A, B}, (A ↔ B) is not derivable', t => {
    const sys = new GentzenSystem();
    sys.addProposition('A');
    sys.addProposition('B');

    const result = sys.searchForProof('(A ↔ B)');

    t.false(result.proven, 'Biconditional introduction is not a sound primitive in this engine');
});

test('alphaRule does not accept "implies" subtype', t => {
    const sys = new GentzenSystem();
    const propA = sys.addProposition('A');
    const propB = sys.addProposition('B');

    t.throws(() => sys.alphaRule(propA, propB, 'implies'), {
        message: /unsupported subtype/
    });
});

test('equivalenceRule is not exposed on GentzenSystem', t => {
    const sys = new GentzenSystem();
    t.is(typeof sys.equivalenceRule, 'undefined');
});

test('Conjunction elimination: from {(A ∧ B)}, A is derivable', t => {
    const sys = new GentzenSystem();
    sys.addFact('(A ∧ B)');

    const result = sys.searchForProof('A');

    t.true(result.proven, '∧E lets the engine decompose conjunctions');
    t.is(result.derivation, 'inference');
});

test('Disjunction elimination requires both implications, not just one', t => {
    const sys = new GentzenSystem();
    sys.addProposition('(A ∨ B)');
    sys.addProposition('(A → C)');

    const result = sys.searchForProof('C');

    t.false(result.proven, '∨E must not fire on a partial three-premise shape');
});

test('Disjunctive MP: ((A ∨ B) → C) plus A derives C', t => {
    const sys = new GentzenSystem();
    sys.addProposition('((A ∨ B) → C)');
    sys.addFact('A');

    const result = sys.searchForProof('C');

    t.true(result.proven);
    t.is(result.derivation, 'inference');
    t.is(result.path.length, 1);
    t.is(result.path[0].rule, 'disjunctiveMP');
});

test('Disjunctive syllogism: (A ∨ B) plus ~A derives B', t => {
    const sys = new GentzenSystem();
    sys.addProposition('(A ∨ B)');
    sys.addProposition('~A');

    const result = sys.searchForProof('B');

    t.true(result.proven);
    t.is(result.path[0].rule, 'disjunctiveSyllogism');
});

test('Disjunctive MP does not fire when no disjunct matches', t => {
    const sys = new GentzenSystem();
    sys.addProposition('((A ∨ B) → C)');
    sys.addFact('Z');

    const result = sys.searchForProof('C');

    t.false(result.proven, 'DMP must not fire on a non-matching supplied formula');
});

test('Asserted-target scenario reports derivation: "asserted"', async t => {
    const dir = await mkdtemp(join(tmpdir(), 'gentzen-assert-'));
    const yamlPath = join(dir, 'assert.yaml');
    try {
        await writeFile(yamlPath, [
            'propositions:',
            '  - WireFunds',
            'targets:',
            '  - WireFunds',
            ''
        ].join('\n'));

        const results = await runGentzenReasoning(yamlPath, {
            customResolvers: {},
            validate: false
        });

        t.is(results.targets.length, 1);
        t.true(results.targets[0].proven);
        t.is(results.targets[0].derivation, 'asserted',
            'WireFunds is a proposition, not a derivation; the result must say so');
        t.is(results.summary.assertedTargets, 1);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});
