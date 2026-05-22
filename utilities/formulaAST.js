// formulaAST.js
// Abstract Syntax Tree definitions and operations for logical formulas

import { CANONICAL, CANONICAL_TO_SYMBOL } from './operators.js';

// AST Node Types
export const ASTNodeType = {
    ATOM: 'atom',
    UNARY: 'unary',
    BINARY: 'binary'
};

// Canonical operator names (e.g. OperatorType.AND === 'and'). Sourced from
// utilities/operators.js so adding an operator is a one-file change.
//
export const OperatorType = CANONICAL;

// Base AST Node class
export class ASTNode {
    constructor(type) {
        this.type = type;
    }
}

// Atomic proposition node (variable/identifier)
export class AtomNode extends ASTNode {
    constructor(name) {
        super(ASTNodeType.ATOM);
        this.name = name;
    }
    
    toString() {
        return this.name;
    }
}

// Unary operator node (negation)
export class UnaryNode extends ASTNode {
    constructor(operator, operand) {
        super(ASTNodeType.UNARY);
        this.operator = operator; // 'not'
        this.operand = operand;   // ASTNode
    }
    
    toString() {
        return `~${this.operand.toString()}`;
    }
}

// Binary operator node (and, or, implies, iff)
export class BinaryNode extends ASTNode {
    constructor(operator, left, right) {
        super(ASTNodeType.BINARY);
        this.operator = operator; // 'and', 'or', 'implies', 'iff'
        this.left = left;         // ASTNode
        this.right = right;       // ASTNode
    }
    
    toString() {
        const symbol = CANONICAL_TO_SYMBOL[this.operator] || this.operator;
        return `(${this.left.toString()} ${symbol} ${this.right.toString()})`;
    }
}

// Convert AST back to string representation
export function astToString(ast) {
    if (!ast) {
        return '';
    }
    return ast.toString();
}

// Walk AST in pre-order, calling `visitor` on every node. For side-effect
// traversals (collecting, validating). For reductions use foldAST; for
// transformations use mapAST.
//
export function walkAST(ast, visitor) {
    if (!ast) return;
    visitor(ast);
    switch (ast.type) {
        case ASTNodeType.UNARY:
            walkAST(ast.operand, visitor);
            break;
        case ASTNodeType.BINARY:
            walkAST(ast.left, visitor);
            walkAST(ast.right, visitor);
            break;
    }
}

// Reduce an AST to a single value. Each handler receives the node and the
// already-reduced results from its children. Post-order: children fold before
// the parent handler runs. Used by getDepth, countNodes, etc.
//
export function foldAST(ast, { onAtom, onUnary, onBinary }) {
    if (!ast) return undefined;
    switch (ast.type) {
        case ASTNodeType.ATOM:
            return onAtom(ast);
        case ASTNodeType.UNARY:
            return onUnary(ast, foldAST(ast.operand, { onAtom, onUnary, onBinary }));
        case ASTNodeType.BINARY:
            return onBinary(
                ast,
                foldAST(ast.left, { onAtom, onUnary, onBinary }),
                foldAST(ast.right, { onAtom, onUnary, onBinary })
            );
        default:
            return undefined;
    }
}

// Transform an AST. Children are transformed first (post-order). Each handler
// receives the original node plus the transformed children and returns the
// replacement node. Omit a handler to use the default reconstruction
// (atoms pass through; unary/binary rebuild with the same operator).
//
export function mapAST(ast, { onAtom, onUnary, onBinary } = {}) {
    if (!ast) return ast;
    switch (ast.type) {
        case ASTNodeType.ATOM:
            return onAtom ? onAtom(ast) : ast;
        case ASTNodeType.UNARY: {
            const operand = mapAST(ast.operand, { onAtom, onUnary, onBinary });
            return onUnary ? onUnary(ast, operand) : new UnaryNode(ast.operator, operand);
        }
        case ASTNodeType.BINARY: {
            const left = mapAST(ast.left, { onAtom, onUnary, onBinary });
            const right = mapAST(ast.right, { onAtom, onUnary, onBinary });
            return onBinary ? onBinary(ast, left, right) : new BinaryNode(ast.operator, left, right);
        }
        default:
            return ast;
    }
}

// Get all atomic propositions (variables) from AST
export function getAtoms(ast) {
    const atoms = new Set();
    walkAST(ast, (node) => {
        if (node.type === ASTNodeType.ATOM) {
            atoms.add(node.name);
        }
    });
    return Array.from(atoms);
}

// Check if two ASTs are structurally equivalent
export function astEquals(ast1, ast2) {
    if (!ast1 && !ast2) return true;
    if (!ast1 || !ast2) return false;
    
    if (ast1.type !== ast2.type) return false;
    
    switch (ast1.type) {
        case ASTNodeType.ATOM:
            return ast1.name === ast2.name;
        case ASTNodeType.UNARY:
            return ast1.operator === ast2.operator && astEquals(ast1.operand, ast2.operand);
        case ASTNodeType.BINARY:
            return ast1.operator === ast2.operator && 
                   astEquals(ast1.left, ast2.left) && 
                   astEquals(ast1.right, ast2.right);
        default:
            return false;
    }
}

// Apply logical normalization transformations.
//
// Two normalizations are applied recursively:
//   1. Double negation elimination: ~~A → A.
//   2. Commutativity canonicalization for ∧, ∨, ↔: sort operands by their
//      canonical string form so that (B ∧ A) and (A ∧ B) produce the same
//      normalized output. Implication (→) is NOT commutative and is left
//      in declared order.
//
// Associativity is NOT canonicalized: ((A ∧ B) ∧ C) and (A ∧ (B ∧ C))
// remain distinct after this pass.
//
export function normalizeAST(ast) {
    return mapAST(ast, {
        onUnary: (node, operand) => {
            // Double negation elimination: ~~A → A.
            //
            if (node.operator === OperatorType.NOT &&
                operand && operand.type === ASTNodeType.UNARY &&
                operand.operator === OperatorType.NOT) {
                return operand.operand;
            }
            return new UnaryNode(node.operator, operand);
        },
        onBinary: (node, left, right) => {
            if (node.operator === OperatorType.AND ||
                node.operator === OperatorType.OR ||
                node.operator === OperatorType.IFF) {
                // Sort operands by canonical-string form. Stable, deterministic.
                //
                const ls = astToString(left);
                const rs = astToString(right);
                if (rs.localeCompare(ls) < 0) {
                    return new BinaryNode(node.operator, right, left);
                }
            }
            return new BinaryNode(node.operator, left, right);
        }
    });
}

// Check if AST represents an implication (A → B)
export function isImplication(ast) {
    return ast && 
           ast.type === ASTNodeType.BINARY && 
           ast.operator === OperatorType.IMPLIES;
}

// Extract components of implication: returns { antecedent, consequent } or null
export function getImplicationParts(ast) {
    if (!isImplication(ast)) {
        return null;
    }
    return {
        antecedent: ast.left,
        consequent: ast.right
    };
}

// Check if AST represents a conjunction (A ∧ B)
export function isConjunction(ast) {
    return ast && 
           ast.type === ASTNodeType.BINARY && 
           ast.operator === OperatorType.AND;
}

// Check if AST represents a disjunction (A ∨ B)
export function isDisjunction(ast) {
    return ast && 
           ast.type === ASTNodeType.BINARY && 
           ast.operator === OperatorType.OR;
}

// Check if AST represents a negation (~A)
export function isNegation(ast) {
    return ast && 
           ast.type === ASTNodeType.UNARY && 
           ast.operator === OperatorType.NOT;
}

// Check if AST represents an atomic proposition
export function isAtom(ast) {
    return ast && ast.type === ASTNodeType.ATOM;
}

// Create a negation of the given AST
export function negate(ast) {
    if (!ast) return null;
    return new UnaryNode(OperatorType.NOT, ast);
}

// Create conjunction of two ASTs
export function createConjunction(left, right) {
    return new BinaryNode(OperatorType.AND, left, right);
}

// Create disjunction of two ASTs
export function createDisjunction(left, right) {
    return new BinaryNode(OperatorType.OR, left, right);
}

// Create implication of two ASTs
export function createImplication(left, right) {
    return new BinaryNode(OperatorType.IMPLIES, left, right);
}

// Create equivalence of two ASTs
export function createEquivalence(left, right) {
    return new BinaryNode(OperatorType.IFF, left, right);
}

// Create atomic proposition
export function createAtom(name) {
    return new AtomNode(name);
}

// Get the depth of an AST (maximum nesting level)
export function getDepth(ast) {
    return foldAST(ast, {
        onAtom: () => 1,
        onUnary: (_node, d) => 1 + d,
        onBinary: (_node, l, r) => 1 + Math.max(l, r)
    }) ?? 0;
}

// Count total number of nodes in AST
export function countNodes(ast) {
    return foldAST(ast, {
        onAtom: () => 1,
        onUnary: (_node, c) => 1 + c,
        onBinary: (_node, l, r) => 1 + l + r
    }) ?? 0;
}

// Validate AST structure
export function validateAST(ast) {
    const errors = [];
    
    function validate(node, path = 'root') {
        if (!node) {
            errors.push(`Null node at ${path}`);
            return;
        }
        
        if (!Object.values(ASTNodeType).includes(node.type)) {
            errors.push(`Invalid node type '${node.type}' at ${path}`);
            return;
        }
        
        switch (node.type) {
            case ASTNodeType.ATOM:
                if (!node.name || typeof node.name !== 'string') {
                    errors.push(`Invalid atom name at ${path}`);
                }
                break;
                
            case ASTNodeType.UNARY:
                if (!Object.values(OperatorType).includes(node.operator)) {
                    errors.push(`Invalid unary operator '${node.operator}' at ${path}`);
                }
                validate(node.operand, `${path}.operand`);
                break;
                
            case ASTNodeType.BINARY:
                if (!Object.values(OperatorType).includes(node.operator)) {
                    errors.push(`Invalid binary operator '${node.operator}' at ${path}`);
                }
                validate(node.left, `${path}.left`);
                validate(node.right, `${path}.right`);
                break;
        }
    }
    
    validate(ast);
    return {
        isValid: errors.length === 0,
        errors
    };
}