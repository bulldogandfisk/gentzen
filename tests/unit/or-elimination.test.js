// or-elimination.test.js
// Unit tests for ∨-elimination (proof by cases): from (A ∨ B), (A → C),
// (B → C), derive C. Three-premise rule implemented as a pattern match
// inside expandOneLevel, with an early-prune on consequent equality.
//

import test from 'ava';
import { GentzenSystem } from '../../gentzen.js';
import { clearNormalizeCache } from '../../utilities/formulaUtils.js';

test.beforeEach(() => {
    clearNormalizeCache();
});

test('orEliminationRule - happy path: derives the shared consequent', t => {
    const sys = new GentzenSystem();
    const disj = sys.addProposition('(A ∨ B)');
    const implA = sys.addProposition('(A → C)');
    const implB = sys.addProposition('(B → C)');

    const result = sys.orEliminationRule(disj, implA, implB);

    t.is(result.origin, 'OrEliminationRule');
    t.is(result.ruleType, 'orElim');
    t.deepEqual([...result.formulas], ['C']);
    t.is(result.from.length, 3);
});

test('orEliminationRule - throws when first input is not a disjunction', t => {
    const sys = new GentzenSystem();
    const conj = sys.addProposition('(A ∧ B)');
    const implA = sys.addProposition('(A → C)');
    const implB = sys.addProposition('(B → C)');

    t.throws(() => sys.orEliminationRule(conj, implA, implB), {
        message: /first input must be a disjunction/
    });
});

test('orEliminationRule - throws when second or third input is not an implication', t => {
    const sys = new GentzenSystem();
    const disj = sys.addProposition('(A ∨ B)');
    const implA = sys.addProposition('(A → C)');
    const notImpl = sys.addProposition('Foo');

    t.throws(() => sys.orEliminationRule(disj, implA, notImpl), {
        message: /must be implications/
    });
});

test('orEliminationRule - throws when consequents disagree', t => {
    const sys = new GentzenSystem();
    const disj = sys.addProposition('(A ∨ B)');
    const implA = sys.addProposition('(A → C)');
    const implB = sys.addProposition('(B → D)');

    t.throws(() => sys.orEliminationRule(disj, implA, implB), {
        message: /consequents must agree/
    });
});

test('orEliminationRule - throws when antecedents do not match disjuncts', t => {
    const sys = new GentzenSystem();
    const disj = sys.addProposition('(A ∨ B)');
    const implX = sys.addProposition('(X → C)');
    const implY = sys.addProposition('(Y → C)');

    t.throws(() => sys.orEliminationRule(disj, implX, implY), {
        message: /do not match the disjuncts/
    });
});

test('searchForProof - derives the shared consequent via BFS ∨E', t => {
    const sys = new GentzenSystem();
    sys.addProposition('(A ∨ B)');
    sys.addProposition('(A → C)');
    sys.addProposition('(B → C)');

    const result = sys.searchForProof('C');

    t.true(result.proven);
    t.is(result.derivation, 'inference');
    const rules = result.path.map(s => s.rule);
    t.true(rules.includes('orElim'), 'path includes the ∨E step');
});

test('searchForProof - antecedent-disjunct order independence', t => {
    // (A → C) listed BEFORE (B → C) — but the disjunction order is (A ∨ B).
    // The matcher must try both orderings of the two implications.
    //
    const sys = new GentzenSystem();
    sys.addProposition('(A ∨ B)');
    sys.addProposition('(B → C)');  // intentionally B-side first
    sys.addProposition('(A → C)');

    const result = sys.searchForProof('C');

    t.true(result.proven, 'order-of-implications must not matter');
});

test('searchForProof - does NOT derive C when one implication is missing (gating)', t => {
    // The three-premise shape requires both implications. With only one,
    // BFS must not derive the consequent.
    //
    const sys = new GentzenSystem();
    sys.addProposition('(A ∨ B)');
    sys.addProposition('(A → C)');
    // No (B → C).

    const result = sys.searchForProof('C');

    t.false(result.proven, '∨E must not fire on a partial three-premise shape');
});

test('searchForProof - does NOT derive C when consequents disagree (early prune)', t => {
    // (A → C), (B → D). Consequents disagree; the early-prune in
    // expandOneLevel filters this triple out before validation.
    //
    const sys = new GentzenSystem();
    sys.addProposition('(A ∨ B)');
    sys.addProposition('(A → C)');
    sys.addProposition('(B → D)');

    const result = sys.searchForProof('C');

    t.false(result.proven);
});

test('searchForProof - chained ∨E + MP', t => {
    // From (A ∨ B), (A → C), (B → C): derive C via ∨E.
    // Then with (C → D): derive D via MP.
    //
    const sys = new GentzenSystem();
    sys.addProposition('(A ∨ B)');
    sys.addProposition('(A → C)');
    sys.addProposition('(B → C)');
    sys.addProposition('(C → D)');

    const result = sys.searchForProof('D');

    t.true(result.proven);
    const rules = result.path.map(s => s.rule);
    t.true(rules.includes('orElim'));
    t.true(rules.includes('modusPonens'));
});
