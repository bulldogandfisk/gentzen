// disjunctive-mp.test.js
// Unit tests for disjunctive modus ponens.
//
// Rule: from ((A ∨ B) → C) and either A or B, derive C.
//

import test from 'ava';
import { GentzenSystem } from '../../gentzen.js';
import { clearNormalizeCache } from '../../utilities/formulaUtils.js';

test.beforeEach(() => {
    clearNormalizeCache();
});

test('disjunctiveModusPonensRule - happy path (left disjunct)', t => {
    const sys = new GentzenSystem();
    const impl = sys.addProposition('((A ∨ B) → C)');
    const a = sys.addProposition('A');

    const result = sys.disjunctiveModusPonensRule(impl, a);

    t.is(result.origin, 'DisjunctiveModusPonensRule');
    t.is(result.ruleType, 'disjunctiveMP');
    t.deepEqual([...result.formulas], ['C']);
    t.is(result.from.length, 2);
});

test('disjunctiveModusPonensRule - happy path (right disjunct)', t => {
    const sys = new GentzenSystem();
    const impl = sys.addProposition('((A ∨ B) → C)');
    const b = sys.addProposition('B');

    const result = sys.disjunctiveModusPonensRule(impl, b);

    t.deepEqual([...result.formulas], ['C']);
});

test('disjunctiveModusPonensRule - throws when first input is not an implication', t => {
    const sys = new GentzenSystem();
    const conj = sys.addProposition('(A ∧ B)');
    const a = sys.addProposition('A');

    t.throws(() => sys.disjunctiveModusPonensRule(conj, a), {
        message: /must be an implication/
    });
});

test('disjunctiveModusPonensRule - throws when antecedent is not a disjunction', t => {
    const sys = new GentzenSystem();
    const impl = sys.addProposition('(A → C)');
    const a = sys.addProposition('A');

    t.throws(() => sys.disjunctiveModusPonensRule(impl, a), {
        message: /antecedent must be a disjunction/
    });
});

test('disjunctiveModusPonensRule - throws when second input matches neither disjunct', t => {
    const sys = new GentzenSystem();
    const impl = sys.addProposition('((A ∨ B) → C)');
    const z = sys.addProposition('Z');

    t.throws(() => sys.disjunctiveModusPonensRule(impl, z), {
        message: /does not match either disjunct/
    });
});

test('searchForProof - derives consequent via single DMP step', t => {
    const sys = new GentzenSystem();
    sys.addProposition('((A ∨ B) → C)');
    sys.addFact('A');

    const result = sys.searchForProof('C');

    t.true(result.proven);
    t.is(result.derivation, 'inference');
    t.is(result.path.length, 1);
    t.is(result.path[0].rule, 'disjunctiveMP');
    t.is(result.path[0].conclusion, 'C');
});

test('searchForProof - DMP fires with operand-order-flipped antecedent (commutativity)', t => {
    // Proposition declares the antecedent as (B ∨ A); commutativity
    // normalization canonicalizes to (A ∨ B), so DMP matches a supplied
    // A or B regardless of how the proposition was written.
    //
    const sys = new GentzenSystem();
    sys.addProposition('((B ∨ A) → C)');
    sys.addFact('A');

    const result = sys.searchForProof('C');

    t.true(result.proven);
    t.is(result.path[0].rule, 'disjunctiveMP');
});

test('searchForProof - DMP with compound disjuncts', t => {
    const sys = new GentzenSystem();
    sys.addProposition('(((A ∧ B) ∨ (C ∧ D)) → Z)');
    const cd = sys.addProposition('(C ∧ D)');

    const result = sys.searchForProof('Z');

    t.true(result.proven);
    t.is(result.path[result.path.length - 1].rule, 'disjunctiveMP');
});

test('Kitchen-sink failover pattern: (~Primary ∨ ~DB) implication fires on one fact', t => {
    // The exact case the P4 audit surfaced. ~PrimaryUp is auto-negated;
    // ~DBUp is not. The rule's antecedent disjunction would not be
    // derivable via strict beta-OR — DMP closes the gap.
    //
    const sys = new GentzenSystem();
    sys.addProposition('((~PrimaryUp ∨ ~DBUp) → ActivateFailover)');
    sys.addFact('~PrimaryUp');

    const result = sys.searchForProof('ActivateFailover');

    t.true(result.proven, 'one true disjunct must trigger the failover rule via DMP');
    t.is(result.derivation, 'inference');
    t.is(result.path[result.path.length - 1].rule, 'disjunctiveMP');
});

test('searchForProof - DMP does NOT fire when supplied formula is neither disjunct', t => {
    const sys = new GentzenSystem();
    sys.addProposition('((A ∨ B) → C)');
    sys.addFact('Z');

    const result = sys.searchForProof('C');

    t.false(result.proven, 'DMP must not fire on a non-matching supplied formula');
});
