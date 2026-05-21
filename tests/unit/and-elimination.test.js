// and-elimination.test.js
// Unit tests for ∧-elimination (left and right) and its firing inside
// expandOneLevel during proof search.
//

import test from 'ava';
import { GentzenSystem } from '../../gentzen.js';
import { clearNormalizeCache } from '../../utilities/formulaUtils.js';

test.beforeEach(() => {
    clearNormalizeCache();
});

test('andEliminationL - extracts the left conjunct', t => {
    const sys = new GentzenSystem();
    const propA = sys.addProposition('A');
    const propB = sys.addProposition('B');
    const conj = sys.alphaRule(propA, propB, 'and');  // (A ∧ B)

    const result = sys.andEliminationL(conj);

    t.is(result.origin, 'AndEliminationRule');
    t.is(result.ruleType, 'andElimL');
    t.deepEqual([...result.formulas], ['A']);
    t.deepEqual(result.from, [conj]);
});

test('andEliminationR - extracts the right conjunct', t => {
    const sys = new GentzenSystem();
    const propA = sys.addProposition('A');
    const propB = sys.addProposition('B');
    const conj = sys.alphaRule(propA, propB, 'and');  // (A ∧ B)

    const result = sys.andEliminationR(conj);

    t.is(result.ruleType, 'andElimR');
    t.deepEqual([...result.formulas], ['B']);
});

test('andEliminationL throws on non-conjunction input', t => {
    const sys = new GentzenSystem();
    const propA = sys.addProposition('A');

    t.throws(() => sys.andEliminationL(propA), {
        message: /requires a conjunction/
    });
});

test('andEliminationR throws on non-conjunction input', t => {
    const sys = new GentzenSystem();
    const impl = sys.addProposition('(A → B)');

    t.throws(() => sys.andEliminationR(impl), {
        message: /requires a conjunction/
    });
});

test('searchForProof derives A from a (A ∧ B) fact', t => {
    const sys = new GentzenSystem();
    sys.addFact('(A ∧ B)');

    const result = sys.searchForProof('A');

    t.true(result.proven);
    t.is(result.derivation, 'inference');
    t.is(result.path.length, 1);
    t.is(result.path[0].rule, 'andElimL');
    t.is(result.path[0].conclusion, 'A');
});

test('searchForProof derives B from a (A ∧ B) fact', t => {
    const sys = new GentzenSystem();
    sys.addFact('(A ∧ B)');

    const result = sys.searchForProof('B');

    t.true(result.proven);
    t.is(result.derivation, 'inference');
    t.is(result.path[0].rule, 'andElimR');
    t.is(result.path[0].conclusion, 'B');
});

test('Nested conjunction: from ((A ∧ B) ∧ C), all three atoms are derivable', t => {
    const sys = new GentzenSystem();
    sys.addFact('((A ∧ B) ∧ C)');

    const resultA = sys.searchForProof('A');
    const resultB = sys.searchForProof('B');
    const resultC = sys.searchForProof('C');

    t.true(resultA.proven);
    t.true(resultB.proven);
    t.true(resultC.proven);
});

test('Combined ∧E + MP: from (A ∧ B) and (A → C), C is derivable', t => {
    const sys = new GentzenSystem();
    sys.addFact('(A ∧ B)');
    sys.addProposition('(A → C)');

    const result = sys.searchForProof('C');

    t.true(result.proven);
    t.is(result.derivation, 'inference');
    // Path should include ∧E-L (or ∧E-R) and MP.
    //
    const rules = result.path.map(s => s.rule);
    t.true(rules.includes('modusPonens'), 'MP step present');
    t.true(rules.some(r => r === 'andElimL' || r === 'andElimR'),
        '∧E step present');
    t.is(result.path[result.path.length - 1].conclusion, 'C');
});
