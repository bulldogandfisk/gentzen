// commutativity.test.js
// normalizeAST canonicalizes operand order for commutative operators
// (∧, ∨, ↔). Implication (→) is NOT commutative.
//

import test from 'ava';
import { GentzenSystem } from '../../gentzen.js';
import { normalizeFormula, clearNormalizeCache } from '../../utilities/formulaUtils.js';

test.beforeEach(() => {
    clearNormalizeCache();
});

test('normalizeFormula - conjunction operand order is canonicalized', t => {
    t.is(normalizeFormula('(B ∧ A)'), normalizeFormula('(A ∧ B)'));
});

test('normalizeFormula - disjunction operand order is canonicalized', t => {
    t.is(normalizeFormula('(B ∨ A)'), normalizeFormula('(A ∨ B)'));
});

test('normalizeFormula - biconditional operand order is canonicalized', t => {
    t.is(normalizeFormula('(B ↔ A)'), normalizeFormula('(A ↔ B)'));
});

test('normalizeFormula - implication operand order is NOT canonicalized', t => {
    // (A → B) and (B → A) are logically distinct; they must stay distinct.
    //
    t.not(normalizeFormula('(A → B)'), normalizeFormula('(B → A)'));
});

test('normalizeFormula - canonicalization is recursive', t => {
    // Inner conjunctions get sorted independently.
    //
    t.is(
        normalizeFormula('((D ∧ C) ∧ (B ∧ A))'),
        normalizeFormula('((A ∧ B) ∧ (C ∧ D))')
    );
});

test('normalizeFormula - canonicalization applies inside implication operands', t => {
    // Implication is not commutative, but its left/right operands ARE normalized.
    //
    t.is(
        normalizeFormula('((B ∧ A) → (D ∨ C))'),
        normalizeFormula('((A ∧ B) → (C ∨ D))')
    );
});

test('MP fires across operand-order mismatch between antecedent and conjunction', t => {
    // Author wrote the rule with one operand order and the YAML step (or
    // BFS derivation) produces the conjunction in the other order. MP must
    // accept this.
    //
    const sys = new GentzenSystem();
    sys.addFact('A');
    sys.addFact('B');
    sys.addProposition('((B ∧ A) → ProcessOrder)');

    const result = sys.searchForProof('ProcessOrder');

    t.true(result.proven, 'MP must match (A ∧ B) derived against (B ∧ A) antecedent');
    t.is(result.derivation, 'inference');
});

test('Search-space reduction: alpha-AND does not produce both (A ∧ B) and (B ∧ A)', t => {
    // With commutativity, the dedup catches both orderings as the same
    // canonical formula. expandOneLevel should produce only one alpha-AND
    // child for the unordered pair {A, B}, not two.
    //
    const sys = new GentzenSystem();
    sys.addProposition('A');
    sys.addProposition('B');

    const children = sys.expandOneLevel();
    const conjunctionChildren = children.filter(c => {
        const last = c.steps[c.steps.length - 1];
        const f = [...last.formulas][0];
        return last.ruleType === 'and' && (f === '(A ∧ B)' || f === '(B ∧ A)');
    });

    t.is(conjunctionChildren.length, 1,
        'commutativity dedup must collapse (A ∧ B) and (B ∧ A) to one child');
});

test('addFact and addProposition canonicalize the stored formula', t => {
    // _knownFormulas is the dedup index; it must contain the canonical form
    // regardless of how the user wrote the formula.
    //
    const sys = new GentzenSystem();
    sys.addFact('(B ∧ A)');

    t.true(sys._knownFormulas.has('(A ∧ B)'),
        '_knownFormulas must hold the canonical form');
});
