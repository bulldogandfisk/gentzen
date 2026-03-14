// formula-ast.test.js - Unit tests for formulaAST.js utilities
//

import test from 'ava';
import {
    ASTNodeType,
    OperatorType,
    createAtom,
    negate,
    createConjunction,
    createDisjunction,
    createImplication,
    createEquivalence,
    getDepth,
    countNodes,
    walkAST,
    astEquals,
    validateAST,
    normalizeAST,
    astToString,
    getImplicationParts,
    isAtom,
    isNegation,
    isConjunction,
    isDisjunction,
    isImplication
} from '../../utilities/formulaAST.js';

// createAtom
//

test('createAtom - creates atom with correct type and name', t => {
    const atom = createAtom('P');

    t.is(atom.type, ASTNodeType.ATOM);
    t.is(atom.name, 'P');
});

// negate
//

test('negate - creates unary negation node', t => {
    const atom = createAtom('P');
    const neg = negate(atom);

    t.is(neg.type, ASTNodeType.UNARY);
    t.is(neg.operator, OperatorType.NOT);
    t.is(neg.operand, atom);
});

test('negate - null input returns null', t => {
    t.is(negate(null), null);
});

// createConjunction
//

test('createConjunction - correct node type and operator', t => {
    const a = createAtom('A');
    const b = createAtom('B');
    const conj = createConjunction(a, b);

    t.is(conj.type, ASTNodeType.BINARY);
    t.is(conj.operator, OperatorType.AND);
    t.is(conj.left, a);
    t.is(conj.right, b);
});

// createDisjunction
//

test('createDisjunction - correct node type and operator', t => {
    const a = createAtom('A');
    const b = createAtom('B');
    const disj = createDisjunction(a, b);

    t.is(disj.type, ASTNodeType.BINARY);
    t.is(disj.operator, OperatorType.OR);
});

// createImplication
//

test('createImplication - correct node type and operator', t => {
    const a = createAtom('A');
    const b = createAtom('B');
    const impl = createImplication(a, b);

    t.is(impl.type, ASTNodeType.BINARY);
    t.is(impl.operator, OperatorType.IMPLIES);
});

// createEquivalence
//

test('createEquivalence - correct node type and operator', t => {
    const a = createAtom('A');
    const b = createAtom('B');
    const equiv = createEquivalence(a, b);

    t.is(equiv.type, ASTNodeType.BINARY);
    t.is(equiv.operator, OperatorType.IFF);
});

// getDepth
//

test('getDepth - atom returns 1', t => {
    t.is(getDepth(createAtom('A')), 1);
});

test('getDepth - negation returns 2', t => {
    t.is(getDepth(negate(createAtom('A'))), 2);
});

test('getDepth - binary returns 1 + max(children)', t => {
    const a = createAtom('A');
    const b = negate(createAtom('B'));
    const conj = createConjunction(a, b);

    // a has depth 1, b has depth 2, so conj has depth 1 + 2 = 3
    t.is(getDepth(conj), 3);
});

test('getDepth - null returns 0', t => {
    t.is(getDepth(null), 0);
});

// countNodes
//

test('countNodes - atom returns 1', t => {
    t.is(countNodes(createAtom('A')), 1);
});

test('countNodes - unary returns 2', t => {
    t.is(countNodes(negate(createAtom('A'))), 2);
});

test('countNodes - binary returns 3', t => {
    const conj = createConjunction(createAtom('A'), createAtom('B'));
    t.is(countNodes(conj), 3);
});

test('countNodes - null returns 0', t => {
    t.is(countNodes(null), 0);
});

// walkAST
//

test('walkAST - visits all nodes pre-order', t => {
    const a = createAtom('A');
    const b = createAtom('B');
    const conj = createConjunction(a, b);

    const visited = [];
    walkAST(conj, (node) => {
        if (node.type === ASTNodeType.ATOM) {
            visited.push(node.name);
        } else {
            visited.push(node.operator);
        }
    });

    // Pre-order: conjunction first, then left (A), then right (B)
    t.deepEqual(visited, [OperatorType.AND, 'A', 'B']);
});

test('walkAST - null input is safe', t => {
    t.notThrows(() => {
        walkAST(null, () => {});
    });
});

// astEquals
//

test('astEquals - identical atoms returns true', t => {
    t.true(astEquals(createAtom('A'), createAtom('A')));
});

test('astEquals - different atoms returns false', t => {
    t.false(astEquals(createAtom('A'), createAtom('B')));
});

test('astEquals - complex trees equal', t => {
    const tree1 = createConjunction(createAtom('A'), negate(createAtom('B')));
    const tree2 = createConjunction(createAtom('A'), negate(createAtom('B')));

    t.true(astEquals(tree1, tree2));
});

test('astEquals - complex trees not equal', t => {
    const tree1 = createConjunction(createAtom('A'), createAtom('B'));
    const tree2 = createDisjunction(createAtom('A'), createAtom('B'));

    t.false(astEquals(tree1, tree2));
});

test('astEquals - both null returns true', t => {
    t.true(astEquals(null, null));
});

test('astEquals - one null returns false', t => {
    t.false(astEquals(createAtom('A'), null));
    t.false(astEquals(null, createAtom('A')));
});

// validateAST
//

test('validateAST - valid atom', t => {
    const result = validateAST(createAtom('A'));
    t.true(result.isValid);
    t.deepEqual(result.errors, []);
});

test('validateAST - null root', t => {
    const result = validateAST(null);
    t.false(result.isValid);
    t.true(result.errors.length > 0);
});

test('validateAST - invalid type', t => {
    const result = validateAST({ type: 'bogus' });
    t.false(result.isValid);
    t.true(result.errors.some(e => e.includes('Invalid node type')));
});

test('validateAST - missing atom name', t => {
    const result = validateAST({ type: ASTNodeType.ATOM, name: '' });
    t.false(result.isValid);
    t.true(result.errors.some(e => e.includes('Invalid atom name')));
});

test('validateAST - invalid operator on unary', t => {
    const node = {
        type: ASTNodeType.UNARY,
        operator: 'bogus',
        operand: createAtom('A')
    };
    const result = validateAST(node);
    t.false(result.isValid);
    t.true(result.errors.some(e => e.includes('Invalid unary operator')));
});

// normalizeAST
//

test('normalizeAST - ~~A normalizes to A', t => {
    const a = createAtom('A');
    const doubleNeg = negate(negate(a));
    const normalized = normalizeAST(doubleNeg);

    t.true(isAtom(normalized));
    t.is(normalized.name, 'A');
});

test('normalizeAST - ~~~A normalizes to ~A', t => {
    const a = createAtom('A');
    const tripleNeg = negate(negate(negate(a)));
    const normalized = normalizeAST(tripleNeg);

    t.true(isNegation(normalized));
    t.true(isAtom(normalized.operand));
    t.is(normalized.operand.name, 'A');
});

test('normalizeAST - null returns null', t => {
    t.is(normalizeAST(null), null);
});

// astToString
//

test('astToString - null returns empty string', t => {
    t.is(astToString(null), '');
});

test('astToString - atom returns name', t => {
    t.is(astToString(createAtom('P')), 'P');
});

test('astToString - conjunction format', t => {
    const conj = createConjunction(createAtom('A'), createAtom('B'));
    t.is(astToString(conj), '(A ∧ B)');
});

// getImplicationParts
//

test('getImplicationParts - returns parts for implication', t => {
    const impl = createImplication(createAtom('A'), createAtom('B'));
    const parts = getImplicationParts(impl);

    t.truthy(parts);
    t.is(parts.antecedent.name, 'A');
    t.is(parts.consequent.name, 'B');
});

test('getImplicationParts - returns null for non-implication', t => {
    const conj = createConjunction(createAtom('A'), createAtom('B'));
    t.is(getImplicationParts(conj), null);
});

// Type check functions
//

test('isAtom - correct identification', t => {
    t.true(isAtom(createAtom('A')));
    t.false(isAtom(negate(createAtom('A'))));
});

test('isNegation - correct identification', t => {
    t.true(isNegation(negate(createAtom('A'))));
    t.false(isNegation(createAtom('A')));
});

test('isConjunction - correct identification', t => {
    t.true(isConjunction(createConjunction(createAtom('A'), createAtom('B'))));
    t.false(isConjunction(createAtom('A')));
});

test('isDisjunction - correct identification', t => {
    t.true(isDisjunction(createDisjunction(createAtom('A'), createAtom('B'))));
    t.false(isDisjunction(createAtom('A')));
});

test('isImplication - correct identification', t => {
    t.true(isImplication(createImplication(createAtom('A'), createAtom('B'))));
    t.false(isImplication(createAtom('A')));
});
