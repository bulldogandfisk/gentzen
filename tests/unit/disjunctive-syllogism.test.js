// disjunctive-syllogism.test.js
// Unit tests for disjunctive syllogism.
//
// Rule: from (A ∨ B) and ~A, derive B. (Symmetric for ~B → A.)
// Also known as "modus tollendo ponens."
//

import test from 'ava';
import { GentzenSystem } from '../../gentzen.js';
import { clearNormalizeCache } from '../../utilities/formulaUtils.js';

test.beforeEach(() => {
    clearNormalizeCache();
});

test('disjunctiveSyllogismRule - happy path (~A derives B)', t => {
    const sys = new GentzenSystem();
    const disj = sys.addProposition('(A ∨ B)');
    const negA = sys.addProposition('~A');

    const result = sys.disjunctiveSyllogismRule(disj, negA);

    t.is(result.origin, 'DisjunctiveSyllogismRule');
    t.is(result.ruleType, 'disjunctiveSyllogism');
    t.deepEqual([...result.formulas], ['B']);
});

test('disjunctiveSyllogismRule - symmetric (~B derives A)', t => {
    const sys = new GentzenSystem();
    const disj = sys.addProposition('(A ∨ B)');
    const negB = sys.addProposition('~B');

    const result = sys.disjunctiveSyllogismRule(disj, negB);

    t.deepEqual([...result.formulas], ['A']);
});

test('disjunctiveSyllogismRule - throws when first input is not a disjunction', t => {
    const sys = new GentzenSystem();
    const conj = sys.addProposition('(A ∧ B)');
    const negA = sys.addProposition('~A');

    t.throws(() => sys.disjunctiveSyllogismRule(conj, negA), {
        message: /must be a disjunction/
    });
});

test('disjunctiveSyllogismRule - throws when second input is not the negation of any disjunct', t => {
    const sys = new GentzenSystem();
    const disj = sys.addProposition('(A ∨ B)');
    const negZ = sys.addProposition('~Z');

    t.throws(() => sys.disjunctiveSyllogismRule(disj, negZ), {
        message: /is not the negation of either disjunct/
    });
});

test('searchForProof - derives surviving disjunct via single DS step', t => {
    const sys = new GentzenSystem();
    sys.addProposition('(A ∨ B)');
    sys.addProposition('~A');

    const result = sys.searchForProof('B');

    t.true(result.proven);
    t.is(result.derivation, 'inference');
    t.is(result.path.length, 1);
    t.is(result.path[0].rule, 'disjunctiveSyllogism');
});

test('searchForProof - DS works against an auto-negated resolver fact', t => {
    // ~A arrives as an auto-negated fact (resolver A returned false).
    //
    const sys = new GentzenSystem();
    sys.addProposition('(A ∨ B)');
    sys.addFact('~A');

    const result = sys.searchForProof('B');

    t.true(result.proven);
    t.is(result.path[0].rule, 'disjunctiveSyllogism');
});

test('searchForProof - DS with compound disjuncts', t => {
    const sys = new GentzenSystem();
    sys.addProposition('((A ∧ B) ∨ (C ∧ D))');
    sys.addProposition('~(A ∧ B)');

    const result = sys.searchForProof('(C ∧ D)');

    t.true(result.proven);
    t.is(result.path[result.path.length - 1].rule, 'disjunctiveSyllogism');
});

test('searchForProof - DS chains into MP', t => {
    // (A ∨ B), ~A, (B → C) → C, derived via DS then MP.
    //
    const sys = new GentzenSystem();
    sys.addProposition('(A ∨ B)');
    sys.addProposition('~A');
    sys.addProposition('(B → C)');

    const result = sys.searchForProof('C');

    t.true(result.proven);
    const rules = result.path.map(s => s.rule);
    t.true(rules.includes('disjunctiveSyllogism'));
    t.true(rules.includes('modusPonens'));
});

test('searchForProof - DS does NOT fire when the negation is unrelated to the disjuncts', t => {
    const sys = new GentzenSystem();
    sys.addProposition('(A ∨ B)');
    sys.addProposition('~Z');

    const result = sys.searchForProof('A');

    t.false(result.proven, 'DS must not fire for an unrelated negation');
});
