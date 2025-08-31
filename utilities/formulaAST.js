// formulaAST.js
// Abstract Syntax Tree definitions and operations for logical formulas

// AST Node Types
export const ASTNodeType = {
    ATOM: 'atom',
    UNARY: 'unary', 
    BINARY: 'binary'
};

// Operator Types
export const OperatorType = {
    NOT: 'not',
    AND: 'and',
    OR: 'or', 
    IMPLIES: 'implies',
    IFF: 'iff'
};

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
        const opSymbols = {
            'and': '∧',
            'or': '∨', 
            'implies': '→',
            'iff': '↔'
        };
        
        const symbol = opSymbols[this.operator] || this.operator;
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

// Get all atomic propositions (variables) from AST
export function getAtoms(ast) {
    const atoms = new Set();
    
    function collectAtoms(node) {
        if (!node) return;
        
        switch (node.type) {
            case ASTNodeType.ATOM:
                atoms.add(node.name);
                break;
            case ASTNodeType.UNARY:
                collectAtoms(node.operand);
                break;
            case ASTNodeType.BINARY:
                collectAtoms(node.left);
                collectAtoms(node.right);
                break;
        }
    }
    
    collectAtoms(ast);
    return Array.from(atoms);
}

// Walk AST with visitor pattern
export function walkAST(ast, visitor) {
    if (!ast) return;
    
    // Pre-order traversal: visit node first, then children
    visitor(ast);
    
    switch (ast.type) {
        case ASTNodeType.UNARY:
            walkAST(ast.operand, visitor);
            break;
        case ASTNodeType.BINARY:
            walkAST(ast.left, visitor);
            walkAST(ast.right, visitor);
            break;
        // ATOM nodes have no children
    }
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

// Apply logical normalization transformations
export function normalizeAST(ast) {
    if (!ast) return ast;
    
    switch (ast.type) {
        case ASTNodeType.ATOM:
            return ast; // Atoms don't need normalization
            
        case ASTNodeType.UNARY:
            // Double negation elimination: ~~A → A
            if (ast.operator === OperatorType.NOT && 
                ast.operand.type === ASTNodeType.UNARY && 
                ast.operand.operator === OperatorType.NOT) {
                return normalizeAST(ast.operand.operand);
            }
            return new UnaryNode(ast.operator, normalizeAST(ast.operand));
            
        case ASTNodeType.BINARY:
            const left = normalizeAST(ast.left);
            const right = normalizeAST(ast.right);
            return new BinaryNode(ast.operator, left, right);
            
        default:
            return ast;
    }
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
    if (!ast) return 0;
    
    switch (ast.type) {
        case ASTNodeType.ATOM:
            return 1;
        case ASTNodeType.UNARY:
            return 1 + getDepth(ast.operand);
        case ASTNodeType.BINARY:
            return 1 + Math.max(getDepth(ast.left), getDepth(ast.right));
        default:
            return 0;
    }
}

// Count total number of nodes in AST
export function countNodes(ast) {
    if (!ast) return 0;
    
    switch (ast.type) {
        case ASTNodeType.ATOM:
            return 1;
        case ASTNodeType.UNARY:
            return 1 + countNodes(ast.operand);
        case ASTNodeType.BINARY:
            return 1 + countNodes(ast.left) + countNodes(ast.right);
        default:
            return 0;
    }
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