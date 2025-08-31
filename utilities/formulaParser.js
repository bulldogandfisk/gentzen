// formulaParser.js
// Recursive descent parser for logical formulas

import { TokenType, tokenize } from './formulaLexer.js';
import { 
    AtomNode, 
    UnaryNode, 
    BinaryNode, 
    OperatorType,
    createAtom,
    negate,
    createConjunction,
    createDisjunction,
    createImplication,
    createEquivalence
} from './formulaAST.js';

// Parse error class
export class ParseError extends Error {
    constructor(message, position, token) {
        super(`Parse error at position ${position}: ${message}`);
        this.position = position;
        this.token = token;
        this.name = 'ParseError';
    }
}

// Recursive descent parser
export class FormulaParser {
    constructor(tokens) {
        this.tokens = tokens;
        this.position = 0;
        this.currentToken = this.tokens[0] || null;
    }
    
    // Advance to next token
    advance() {
        this.position += 1;
        this.currentToken = this.position < this.tokens.length ? this.tokens[this.position] : null;
    }
    
    // Check if current token matches expected type and value
    match(tokenType, value = null) {
        if (!this.currentToken) return false;
        if (this.currentToken.type !== tokenType) return false;
        if (value !== null && this.currentToken.value !== value) return false;
        return true;
    }
    
    // Consume token if it matches, otherwise throw error
    consume(tokenType, value = null, errorMsg = null) {
        if (!this.match(tokenType, value)) {
            const expected = value ? `'${value}'` : tokenType;
            const actual = this.currentToken ? 
                `'${this.currentToken.value}'` : 'end of input';
            const msg = errorMsg || `Expected ${expected} but found ${actual}`;
            throw new ParseError(msg, this.currentToken?.position || this.position, this.currentToken);
        }
        const token = this.currentToken;
        this.advance();
        return token;
    }
    
    // Parse the complete formula
    parse() {
        try {
            const ast = this.parseEquivalence();
            
            // Ensure we've consumed all tokens
            if (this.currentToken && this.currentToken.type !== TokenType.EOF) {
                throw new ParseError(
                    `Unexpected token '${this.currentToken.value}' after complete formula`,
                    this.currentToken.position,
                    this.currentToken
                );
            }
            
            return ast;
        } catch (error) {
            if (error instanceof ParseError) {
                throw error;
            }
            throw new ParseError(`Unexpected parsing error: ${error.message}`, this.position, this.currentToken);
        }
    }
    
    // Parse equivalence (lowest precedence: A ↔ B)
    // equivalence ::= implication (('↔' | 'IFF' | '<->' | '<=>') implication)*
    parseEquivalence() {
        let left = this.parseImplication();
        
        while (this.match(TokenType.OPERATOR, 'iff')) {
            this.advance(); // consume iff operator
            const right = this.parseImplication();
            left = createEquivalence(left, right);
        }
        
        return left;
    }
    
    // Parse implication (A → B, right associative)
    // implication ::= disjunction (('→' | 'IMPLIES' | '->' | '=>') implication)?
    parseImplication() {
        const left = this.parseDisjunction();
        
        if (this.match(TokenType.OPERATOR, 'implies')) {
            this.advance(); // consume implies operator
            // Right associative: A → B → C becomes A → (B → C)
            const right = this.parseImplication(); 
            return createImplication(left, right);
        }
        
        return left;
    }
    
    // Parse disjunction (A ∨ B, left associative)
    // disjunction ::= conjunction (('∨' | 'OR' | '|') conjunction)*
    parseDisjunction() {
        let left = this.parseConjunction();
        
        while (this.match(TokenType.OPERATOR, 'or')) {
            this.advance(); // consume or operator
            const right = this.parseConjunction();
            left = createDisjunction(left, right);
        }
        
        return left;
    }
    
    // Parse conjunction (A ∧ B, left associative)
    // conjunction ::= negation (('∧' | 'AND' | '&') negation)*
    parseConjunction() {
        let left = this.parseNegation();
        
        while (this.match(TokenType.OPERATOR, 'and')) {
            this.advance(); // consume and operator
            const right = this.parseNegation();
            left = createConjunction(left, right);
        }
        
        return left;
    }
    
    // Parse negation (~A, ~~A, right associative)
    // negation ::= ('~' | 'NOT' | '!')* primary
    parseNegation() {
        if (this.match(TokenType.OPERATOR, 'not')) {
            this.advance(); // consume not operator
            // Right associative: ~ ~ A becomes ~(~A)
            const operand = this.parseNegation();
            return negate(operand);
        }
        
        return this.parsePrimary();
    }
    
    // Parse primary expressions (atoms and parenthesized formulas)
    // primary ::= identifier | '(' formula ')'
    parsePrimary() {
        // Parenthesized expression
        if (this.match(TokenType.LPAREN)) {
            this.advance(); // consume '('
            const expr = this.parseEquivalence(); // Parse nested formula
            this.consume(TokenType.RPAREN, ')', "Expected ')' after expression");
            return expr;
        }
        
        // Atomic proposition (identifier)
        if (this.match(TokenType.IDENTIFIER)) {
            const token = this.currentToken;
            this.advance();
            return createAtom(token.value);
        }
        
        // Error: unexpected token
        const actual = this.currentToken ? 
            `'${this.currentToken.value}'` : 'end of input';
        throw new ParseError(
            `Expected identifier or '(' but found ${actual}`,
            this.currentToken?.position || this.position,
            this.currentToken
        );
    }
}

// Convenience function to parse a formula string
export function parseFormulaFromString(input) {
    const tokens = tokenize(input);
    const parser = new FormulaParser(tokens);
    return parser.parse();
}

// Validate formula syntax without building AST
export function validateFormulaSyntax(input) {
    try {
        parseFormulaFromString(input);
        return { isValid: true, errors: [] };
    } catch (error) {
        if (error instanceof ParseError) {
            return { 
                isValid: false, 
                errors: [error.message],
                position: error.position
            };
        }
        return {
            isValid: false,
            errors: [`Unexpected error: ${error.message}`]
        };
    }
}

// Get detailed parse information
export function getParseInfo(input) {
    try {
        const tokens = tokenize(input);
        const parser = new FormulaParser(tokens);
        const ast = parser.parse();
        
        return {
            success: true,
            tokens: tokens.filter(t => t.type !== TokenType.EOF),
            ast,
            errors: []
        };
    } catch (error) {
        return {
            success: false,
            tokens: [],
            ast: null,
            errors: [error.message]
        };
    }
}