// modus-tollens.test.js
// Unit tests for the modusTollensRule method and its automatic firing
// inside expandOneLevel during proof search.
//
// MT: given (A → B) and ~B, derive ~A.
//

import test from 'ava';
import { GentzenSystem } from '../../gentzen.js';
import { clearNormalizeCache } from '../../utilities/formulaUtils.js';

test.beforeEach(() => {
    clearNormalizeCache();
});

test('modusTollensRule - happy path: (A → B) plus ~B derives ~A', t => {
    const sys = new GentzenSystem();
    const impl = sys.addProposition('(A → B)');
    const negB = sys.addProposition('~B');

    const result = sys.modusTollensRule(impl, negB);

    t.is(result.origin, 'ModusTollensRule');
    t.is(result.ruleType, 'modusTollens');
    t.deepEqual([...result.formulas], ['~A']);
    t.is(result.from.length, 2);
    t.is(result.from[0], impl);
    t.is(result.from[1], negB);
});

test('modusTollensRule - throws when first input is not an implication', t => {
    const sys = new GentzenSystem();
    const propA = sys.addProposition('A');
    const propB = sys.addProposition('B');
    const conj = sys.alphaRule(propA, propB, 'and');

    t.throws(() => sys.modusTollensRule(conj, sys.addProposition('~B')), {
        message: /must be an implication/
    });
});

test('modusTollensRule - throws when second input does not match negated consequent', t => {
    const sys = new GentzenSystem();
    const impl = sys.addProposition('(A → B)');
    const wrong = sys.addProposition('~C');

    t.throws(() => sys.modusTollensRule(impl, wrong), {
        message: /negated-consequent mismatch/
    });
});

test('searchForProof derives ~A in a single MT step', t => {
    // From (A → B) and ~B, the path has length 1 with rule 'modusTollens'.
    //
    const sys = new GentzenSystem();
    sys.addProposition('(A → B)');
    sys.addProposition('~B');

    const result = sys.searchForProof('~A');

    t.true(result.proven);
    t.is(result.derivation, 'inference');
    t.is(result.path.length, 1, 'MT collapses the contraposition+MP chain into one step');
    t.is(result.path[0].rule, 'modusTollens');
    t.is(result.path[0].conclusion, '~A');
});

test('searchForProof - MT on compound consequent: (A → (B ∧ C)) + ~(B ∧ C) → ~A', t => {
    const sys = new GentzenSystem();
    sys.addProposition('(A → (B ∧ C))');
    sys.addProposition('~(B ∧ C)');

    const result = sys.searchForProof('~A');

    t.true(result.proven);
    t.is(result.derivation, 'inference');
    const rules = result.path.map(s => s.rule);
    t.true(rules.includes('modusTollens'));
});

test('Chained MT: (A → B), (B → C), ~C → ~A in two MT steps', t => {
    const sys = new GentzenSystem();
    sys.addProposition('(A → B)');
    sys.addProposition('(B → C)');
    sys.addProposition('~C');

    const result = sys.searchForProof('~A');

    t.true(result.proven);
    const rules = result.path.map(s => s.rule);
    t.true(rules.filter(r => r === 'modusTollens').length >= 1,
        'at least one MT step in the chain');
});

test('MT against an atomic-fact negated consequent (BFS over facts)', t => {
    // Resolver provides ~B as a fact (e.g., a sensor reported "feature is off").
    // The rule (A → B) is a proposition. MT should fire and derive ~A.
    //
    const sys = new GentzenSystem();
    sys.addFact('~B');
    sys.addProposition('(A → B)');

    const result = sys.searchForProof('~A');

    t.true(result.proven);
    t.is(result.derivation, 'inference');
});
