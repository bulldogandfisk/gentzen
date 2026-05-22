// formulaLexer.js
// Tokenizer for logical formulas with operator normalization

import { ALIAS_TO_CANONICAL } from './operators.js';

// Token types
export const TokenType = {
    IDENTIFIER: 'IDENTIFIER',
    OPERATOR: 'OPERATOR',
    LPAREN: 'LPAREN',
    RPAREN: 'RPAREN',
    EOF: 'EOF'
};

const OPERATOR_MAPPINGS = ALIAS_TO_CANONICAL;

// Token class
export class Token {
    constructor(type, value, position = 0) {
        this.type = type;
        this.value = value;
        this.position = position;
    }
    
    toString() {
        return `Token(${this.type}, '${this.value}', ${this.position})`;
    }
}

// Pre-sorted operator keys (longest first) for efficient matching
const SORTED_OPERATOR_KEYS = Object.keys(OPERATOR_MAPPINGS).sort((a, b) => b.length - a.length);

// Lexer class
export class FormulaLexer {
    constructor(input) {
        this.input = input.trim();
        this.position = 0;
        this.current_char = this.input[this.position] || null;
    }
    
    // Advance position and update current character
    advance() {
        this.position += 1;
        this.current_char = this.position < this.input.length ? this.input[this.position] : null;
    }
    
    // Peek at next character without advancing
    peek() {
        const peek_pos = this.position + 1;
        return peek_pos < this.input.length ? this.input[peek_pos] : null;
    }
    
    // Skip whitespace characters
    skipWhitespace() {
        while (this.current_char && /\s/.test(this.current_char)) {
            this.advance();
        }
    }
    
    // Read an identifier (variable name or keyword)
    readIdentifier() {
        const start_pos = this.position;
        let result = '';
        
        // First character must be letter
        if (!/[A-Za-z]/.test(this.current_char)) {
            throw new Error(`Invalid identifier start character '${this.current_char}' at position ${this.position}`);
        }
        
        // Read letters, digits, underscores
        while (this.current_char && /[A-Za-z0-9_]/.test(this.current_char)) {
            result += this.current_char;
            this.advance();
        }
        
        return new Token(TokenType.IDENTIFIER, result, start_pos);
    }
    
    // Read a multi-character operator. Caller must guarantee
    // startsOperator() returned true at this position; startsOperator
    // already enforces the word-boundary rule for alphabetic operators.
    //
    readOperator() {
        const start_pos = this.position;
        const remaining = this.input.slice(this.position);

        for (const op of SORTED_OPERATOR_KEYS) {
            if (remaining.startsWith(op)) {
                for (let i = 0; i < op.length; i++) {
                    this.advance();
                }
                return new Token(TokenType.OPERATOR, OPERATOR_MAPPINGS[op], start_pos);
            }
        }

        throw new Error(`Unknown operator starting with '${this.current_char}' at position ${this.position}`);
    }
    
    // Check if current position starts an operator
    // For alphabetic keywords (NOT, AND, etc.), require a word boundary
    // so that identifiers like NOThing or ORacle are not misparsed.
    //
    startsOperator() {
        if (!this.current_char) return false;

        const remaining = this.input.slice(this.position);
        return SORTED_OPERATOR_KEYS.some(op => {
            if (!remaining.startsWith(op)) {
                return false;
            }
            if (/[A-Za-z]/.test(op[0])) {
                const nextChar = remaining[op.length];
                if (nextChar && /[A-Za-z0-9_]/.test(nextChar)) {
                    return false;
                }
            }
            return true;
        });
    }
    
    // Get the next token
    getNextToken() {
        while (this.current_char) {
            // Skip whitespace
            if (/\s/.test(this.current_char)) {
                this.skipWhitespace();
                continue;
            }
            
            // Left parenthesis
            if (this.current_char === '(') {
                const token = new Token(TokenType.LPAREN, '(', this.position);
                this.advance();
                return token;
            }
            
            // Right parenthesis
            if (this.current_char === ')') {
                const token = new Token(TokenType.RPAREN, ')', this.position);
                this.advance();
                return token;
            }
            
            // Operators (including multi-character ones)
            if (this.startsOperator()) {
                return this.readOperator();
            }
            
            // Identifiers (variables, keywords)
            if (/[A-Za-z]/.test(this.current_char)) {
                return this.readIdentifier();
            }
            
            // Unknown character
            throw new Error(`Unexpected character '${this.current_char}' at position ${this.position}`);
        }
        
        // End of input
        return new Token(TokenType.EOF, null, this.position);
    }
    
    // Tokenize entire input into array of tokens
    tokenize() {
        const tokens = [];
        let token = this.getNextToken();
        
        while (token.type !== TokenType.EOF) {
            tokens.push(token);
            token = this.getNextToken();
        }
        
        tokens.push(token); // Include EOF token
        return tokens;
    }
}

// Convenience function
export function tokenize(input) {
    const lexer = new FormulaLexer(input);
    return lexer.tokenize();
}

// Get canonical operator name
export function getCanonicalOperator(op) {
    return OPERATOR_MAPPINGS[op] || op;
}

// Check if string is a valid operator
export function isOperator(str) {
    return str in OPERATOR_MAPPINGS;
}