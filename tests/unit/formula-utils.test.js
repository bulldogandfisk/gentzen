// formula-utils.test.js - Unit tests for formulaUtils.js
//

import test from 'ava';
import {
    normalizeFormula,
    extractFormulaAtoms,
    addFormulaAtomsToSet,
    canonicalDoubleNeg,
    extractMissingFactsFromFormula,
    clearNormalizeCache
} from '../../utilities/formulaUtils.js';

// normalizeFormula
//

test('normalizeFormula - A AND B normalizes to canonical form', t => {
    const result = normalizeFormula('A AND B');
    t.is(result, '(A ∧ B)');
});

test('normalizeFormula - ~~A normalizes to A', t => {
    const result = normalizeFormula('~~A');
    t.is(result, 'A');
});

test('normalizeFormula - preserves atom', t => {
    const result = normalizeFormula('Foo');
    t.is(result, 'Foo');
});

// extractFormulaAtoms
//

test('extractFormulaAtoms - extracts atoms from compound formula', t => {
    const atoms = extractFormulaAtoms('(A ∧ B) → C');
    t.true(atoms.includes('A'));
    t.true(atoms.includes('B'));
    t.true(atoms.includes('C'));
    t.is(atoms.length, 3);
});

// addFormulaAtomsToSet
//

test('addFormulaAtomsToSet - mutates the provided set', t => {
    const atomSet = new Set();
    addFormulaAtomsToSet('(X ∧ Y)', atomSet);

    t.true(atomSet.has('X'));
    t.true(atomSet.has('Y'));
    t.is(atomSet.size, 2);
});

// canonicalDoubleNeg
//

test('canonicalDoubleNeg - ~~~~A reduces to A', t => {
    t.is(canonicalDoubleNeg('~~~~A'), 'A');
});

test('canonicalDoubleNeg - ~A unchanged (single negation)', t => {
    t.is(canonicalDoubleNeg('~A'), '~A');
});

test('canonicalDoubleNeg - A unchanged (no negation)', t => {
    t.is(canonicalDoubleNeg('A'), 'A');
});

test('canonicalDoubleNeg - ~~A reduces to A', t => {
    t.is(canonicalDoubleNeg('~~A'), 'A');
});

// extractMissingFactsFromFormula
//

test('extractMissingFactsFromFormula - all resolvable', t => {
    const result = extractMissingFactsFromFormula('(A ∧ B)', () => true);

    t.true(result.canResolve);
    t.deepEqual(result.missing, []);
});

test('extractMissingFactsFromFormula - unresolvable atoms', t => {
    const resolvable = new Set(['A']);
    const result = extractMissingFactsFromFormula(
        '(A ∧ B)',
        (atom) => resolvable.has(atom)
    );

    t.false(result.canResolve);
    t.true(result.missing.includes('B'));
});

// clearNormalizeCache
//

test('clearNormalizeCache - clears cached entries', t => {
    // Populate cache
    //
    normalizeFormula('CacheTest1');
    normalizeFormula('CacheTest2');

    // Clear should not throw
    //
    t.notThrows(() => {
        clearNormalizeCache();
    });

    // Formulas should still normalize correctly after clearing
    //
    const result = normalizeFormula('CacheTest1');
    t.is(result, 'CacheTest1');
});
