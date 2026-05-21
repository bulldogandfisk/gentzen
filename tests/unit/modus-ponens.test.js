// modus-ponens.test.js
// Unit tests for the modusPonensRule method and its automatic firing
// inside expandOneLevel during proof search.
//

import test from 'ava';
import { GentzenSystem } from '../../gentzen.js';
import { clearNormalizeCache } from '../../utilities/formulaUtils.js';

test.beforeEach(() => {
    clearNormalizeCache();
});

test('modusPonensRule - happy path: (A → B) plus A derives B', t => {
    const sys = new GentzenSystem();
    const propA = sys.addProposition('A');
    const impl = sys.addProposition('(A → B)');

    const result = sys.modusPonensRule(impl, propA);

    t.is(result.origin, 'ModusPonensRule');
    t.is(result.ruleType, 'modusPonens');
    t.deepEqual([...result.formulas], ['B']);
    t.is(result.from.length, 2);
    t.is(result.from[0], impl);
    t.is(result.from[1], propA);
});

test('modusPonensRule - matches antecedent regardless of input formula syntax variations', t => {
    // The implication is built with Unicode → but the antecedent is supplied
    // via a step whose formula spells the antecedent literally. Normalize-based
    // matching should accept either canonical form.
    //
    const sys = new GentzenSystem();
    const propA = sys.addProposition('A');
    const propB = sys.addProposition('B');
    const compound = sys.alphaRule(propA, propB, 'and');  // (A ∧ B)
    const impl = sys.addProposition('((A ∧ B) → C)');

    const result = sys.modusPonensRule(impl, compound);

    t.deepEqual([...result.formulas], ['C']);
});

test('modusPonensRule - throws when first input is not an implication', t => {
    const sys = new GentzenSystem();
    const propA = sys.addProposition('A');
    const propB = sys.addProposition('B');
    const conj = sys.alphaRule(propA, propB, 'and');  // (A ∧ B), not an implication

    t.throws(() => sys.modusPonensRule(conj, propA), {
        message: /must be an implication/
    });
});

test('modusPonensRule - throws when antecedent does not match second input', t => {
    const sys = new GentzenSystem();
    const propC = sys.addProposition('C');
    const impl = sys.addProposition('(A → B)');

    t.throws(() => sys.modusPonensRule(impl, propC), {
        message: /antecedent mismatch/
    });
});

test('searchForProof - derives consequent via automatic modus ponens', t => {
    // The load-bearing MP test. B is NOT a declared proposition, NOT a
    // resolved fact, and NOT the output of any explicit rule in the system.
    // The ONLY way for searchForProof to return proven=true is for MP to
    // fire automatically during expandOneLevel — pairing (A → B) with A
    // to derive B in a child system. If MP is removed from the engine, or
    // the antecedent matching is broken, or expandOneLevel doesn't try MP,
    // this test fails.
    //
    const sys = new GentzenSystem();
    sys.addProposition('A');
    sys.addProposition('(A → B)');

    const result = sys.searchForProof('B');

    t.true(result.proven, 'B should be derivable via modus ponens');
    t.is(result.missingFacts.length, 0);
});

test('searchForProof - chained implications close via repeated MP', t => {
    // (A → B), (B → C), A — search should derive C in two MP steps.
    //
    const sys = new GentzenSystem();
    sys.addProposition('A');
    sys.addProposition('(A → B)');
    sys.addProposition('(B → C)');

    const result = sys.searchForProof('C');

    t.true(result.proven, 'C should derive via two MP applications');
    t.is(result.missingFacts.length, 0);
});

test('searchForProof - MP does not fire when antecedent absent', t => {
    // (A → B) without A. B is not derivable.
    //
    const sys = new GentzenSystem();
    sys.addProposition('(A → B)');

    const result = sys.searchForProof('B');

    // B is not in facts and A is not in the system, so canResolveFormula
    // for B returns missing facts and search fails before BFS even starts.
    //
    t.false(result.proven);
});
