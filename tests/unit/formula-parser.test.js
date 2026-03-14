import test from 'ava';
import { tokenize } from '../../utilities/formulaLexer.js';
import { FormulaParser, ParseError } from '../../utilities/formulaParser.js';
import { parseFormula } from '../../gentzen.js';
import { 
    AtomNode, 
    UnaryNode, 
    BinaryNode, 
    OperatorType,
    astEquals,
    isAtom,
    isNegation,
    isConjunction,
    isDisjunction,
    isImplication,
    getAtoms
} from '../../utilities/formulaAST.js';

// Test tokenizer
test('tokenizer handles basic atoms', t => {
    const tokens = tokenize('CustomerIsVIP');
    t.is(tokens.length, 2); // identifier + EOF
    t.is(tokens[0].type, 'IDENTIFIER');
    t.is(tokens[0].value, 'CustomerIsVIP');
});

test('tokenizer normalizes operators', t => {
    const tests = [
        ['A ∧ B', ['A', 'and', 'B']],
        ['A AND B', ['A', 'and', 'B']],
        ['A & B', ['A', 'and', 'B']],
        ['A ∨ B', ['A', 'or', 'B']],
        ['A OR B', ['A', 'or', 'B']],
        ['A | B', ['A', 'or', 'B']],
        ['A → B', ['A', 'implies', 'B']],
        ['A IMPLIES B', ['A', 'implies', 'B']],
        ['A -> B', ['A', 'implies', 'B']],
        ['A => B', ['A', 'implies', 'B']],
        ['A ↔ B', ['A', 'iff', 'B']],
        ['A IFF B', ['A', 'iff', 'B']],
        ['A <-> B', ['A', 'iff', 'B']],
        ['A <=> B', ['A', 'iff', 'B']],
        ['~A', ['not', 'A']],
        ['NOT A', ['not', 'A']],
        ['!A', ['not', 'A']]
    ];
    
    for (const [input, expected] of tests) {
        const tokens = tokenize(input);
        const values = tokens.filter(t => t.type !== 'EOF').map(t => t.value);
        t.deepEqual(values, expected, `Failed for input: ${input}`);
    }
});

test('tokenizer handles parentheses', t => {
    const tokens = tokenize('(A ∧ B)');
    const values = tokens.filter(t => t.type !== 'EOF').map(t => t.value);
    t.deepEqual(values, ['(', 'A', 'and', 'B', ')']);
});

// Test parser
test('parser handles atomic propositions', t => {
    const tokens = tokenize('CustomerIsVIP');
    const parser = new FormulaParser(tokens);
    const ast = parser.parse();
    
    t.true(isAtom(ast));
    t.is(ast.name, 'CustomerIsVIP');
});

test('parser handles negation', t => {
    const tokens = tokenize('~UserHasPermission');
    const parser = new FormulaParser(tokens);
    const ast = parser.parse();
    
    t.true(isNegation(ast));
    t.is(ast.operator, OperatorType.NOT);
    t.true(isAtom(ast.operand));
    t.is(ast.operand.name, 'UserHasPermission');
});

test('parser handles double negation elimination', t => {
    const result = parseFormula('~~DatabaseConnected');
    t.is(result.toString(), 'DatabaseConnected');
    t.true(isAtom(result.ast));
});

test('parser handles conjunction', t => {
    const tokens = tokenize('A ∧ B');
    const parser = new FormulaParser(tokens);
    const ast = parser.parse();
    
    t.true(isConjunction(ast));
    t.is(ast.operator, OperatorType.AND);
    t.is(ast.left.name, 'A');
    t.is(ast.right.name, 'B');
});

test('parser handles disjunction', t => {
    const tokens = tokenize('A ∨ B');
    const parser = new FormulaParser(tokens);
    const ast = parser.parse();
    
    t.true(isDisjunction(ast));
    t.is(ast.operator, OperatorType.OR);
    t.is(ast.left.name, 'A');
    t.is(ast.right.name, 'B');
});

test('parser handles implication', t => {
    const tokens = tokenize('A → B');
    const parser = new FormulaParser(tokens);
    const ast = parser.parse();
    
    t.true(isImplication(ast));
    t.is(ast.operator, OperatorType.IMPLIES);
    t.is(ast.left.name, 'A');
    t.is(ast.right.name, 'B');
});

test('parser respects operator precedence', t => {
    // ~ has highest precedence
    const result1 = parseFormula('~A ∧ B');
    t.is(result1.toString(), '(~A ∧ B)');
    
    // ∧ has higher precedence than ∨
    const result2 = parseFormula('A ∧ B ∨ C');
    t.is(result2.toString(), '((A ∧ B) ∨ C)');
    
    // ∨ has higher precedence than →
    const result3 = parseFormula('A ∨ B → C');
    t.is(result3.toString(), '((A ∨ B) → C)');
});

test('parser handles right associativity for implication', t => {
    const result = parseFormula('A → B → C');
    t.is(result.toString(), '(A → (B → C))');
});

test('parser handles left associativity for conjunction', t => {
    const result = parseFormula('A ∧ B ∧ C');
    t.is(result.toString(), '((A ∧ B) ∧ C)');
});

test('parser handles parentheses correctly', t => {
    const result = parseFormula('(A ∧ B) → (C ∨ D)');
    t.is(result.toString(), '((A ∧ B) → (C ∨ D))');
});

test('parser handles complex nested formulas', t => {
    const result = parseFormula('((A ∧ B) → (C ∨ D))');
    t.is(result.toString(), '((A ∧ B) → (C ∨ D))');
});

test('parser handles operator normalization', t => {
    const tests = [
        ['A AND B', '(A ∧ B)'],
        ['A & B', '(A ∧ B)'],
        ['A OR B', '(A ∨ B)'],
        ['A | B', '(A ∨ B)'],
        ['A IMPLIES B', '(A → B)'],
        ['A -> B', '(A → B)'],
        ['A => B', '(A → B)'],
        ['A IFF B', '(A ↔ B)'],
        ['A <-> B', '(A ↔ B)'],
        ['A <=> B', '(A ↔ B)'],
        ['NOT A', '~A'],
        ['!A', '~A']
    ];
    
    for (const [input, expected] of tests) {
        const result = parseFormula(input);
        t.is(result.toString(), expected, `Failed for input: ${input}`);
    }
});

test('parser extracts atoms correctly', t => {
    const result = parseFormula('(CustomerIsVIP ∧ PaymentProcessed) → ProcessOrder');
    const atoms = getAtoms(result.ast);
    t.deepEqual(atoms.sort(), ['CustomerIsVIP', 'PaymentProcessed', 'ProcessOrder']);
});

test('parser extracts atoms from negated formulas', t => {
    const result = parseFormula('~UserHasPermission ∧ SecurityCheckPassed');
    const atoms = getAtoms(result.ast);
    t.deepEqual(atoms.sort(), ['SecurityCheckPassed', 'UserHasPermission']);
});

// Error handling tests
test('parser throws error for unbalanced parentheses', t => {
    const tokens = tokenize('(A ∧ B');
    const parser = new FormulaParser(tokens);
    t.throws(() => parser.parse(), { instanceOf: ParseError });
});

test('parser throws error for missing operand', t => {
    const tokens = tokenize('A ∧');
    const parser = new FormulaParser(tokens);
    t.throws(() => parser.parse(), { instanceOf: ParseError });
});

test('parser throws error for invalid identifier', t => {
    t.throws(() => tokenize('User-Name'), { message: /Unexpected character/ });
});

test('parser throws error for unknown operator', t => {
    t.throws(() => tokenize('A % B'), { message: /Unexpected character/ });
});

test('parser throws error for invalid formulas', t => {
    t.throws(() => {
        parseFormula('A %% B');  // Invalid syntax
    }, { message: /Unexpected character/ });
});

test('parser throws error for trailing tokens after complete formula', t => {
    const tokens = tokenize('A B');
    const parser = new FormulaParser(tokens);
    t.throws(() => parser.parse(), {
        instanceOf: ParseError,
        message: /Unexpected token/
    });
});

// validateFormulaSyntax and getParseInfo tests
import { validateFormulaSyntax, getParseInfo } from '../../utilities/formulaParser.js';
import { Token, TokenType as LexerTokenType, FormulaLexer, getCanonicalOperator, isOperator } from '../../utilities/formulaLexer.js';

test('validateFormulaSyntax - valid formula returns isValid true', t => {
    const result = validateFormulaSyntax('A ∧ B');
    t.true(result.isValid);
    t.deepEqual(result.errors, []);
});

test('validateFormulaSyntax - invalid formula returns isValid false with position', t => {
    const result = validateFormulaSyntax('A ∧');
    t.false(result.isValid);
    t.true(result.errors.length > 0);
    t.is(typeof result.position, 'number');
});

test('getParseInfo - valid formula returns success with tokens and ast', t => {
    const result = getParseInfo('A ∧ B');
    t.true(result.success);
    t.true(result.tokens.length > 0);
    t.truthy(result.ast);
    t.deepEqual(result.errors, []);
});

test('getParseInfo - invalid formula returns success false', t => {
    const result = getParseInfo('A ∧');
    t.false(result.success);
    t.is(result.ast, null);
    t.true(result.errors.length > 0);
});

test('getCanonicalOperator - maps operator aliases', t => {
    t.is(getCanonicalOperator('∧'), 'and');
    t.is(getCanonicalOperator('AND'), 'and');
    t.is(getCanonicalOperator('&'), 'and');
    t.is(getCanonicalOperator('→'), 'implies');
    t.is(getCanonicalOperator('~'), 'not');
    // Unknown operator returns itself
    t.is(getCanonicalOperator('unknown'), 'unknown');
});

test('isOperator - true for valid operators, false for invalid', t => {
    t.true(isOperator('∧'));
    t.true(isOperator('AND'));
    t.true(isOperator('~'));
    t.true(isOperator('→'));
    t.false(isOperator('FOO'));
    t.false(isOperator('x'));
});

test('ParseError has position and name properties', t => {
    const tokens = tokenize('A ∧');
    const parser = new FormulaParser(tokens);
    const error = t.throws(() => parser.parse(), { instanceOf: ParseError });
    t.is(typeof error.position, 'number');
    t.is(error.name, 'ParseError');
});

// Word-boundary tests for lexer operator keywords
//

test('tokenizer treats NOThing as identifier, not NOT operator', t => {
    const tokens = tokenize('NOThing');
    const nonEof = tokens.filter(tok => tok.type !== 'EOF');
    t.is(nonEof.length, 1);
    t.is(nonEof[0].type, 'IDENTIFIER');
    t.is(nonEof[0].value, 'NOThing');
});

test('tokenizer treats ORacle as identifier, not OR operator', t => {
    const tokens = tokenize('ORacle');
    const nonEof = tokens.filter(tok => tok.type !== 'EOF');
    t.is(nonEof.length, 1);
    t.is(nonEof[0].type, 'IDENTIFIER');
    t.is(nonEof[0].value, 'ORacle');
});

test('tokenizer treats ANDroid as identifier, not AND operator', t => {
    const tokens = tokenize('ANDroid');
    const nonEof = tokens.filter(tok => tok.type !== 'EOF');
    t.is(nonEof.length, 1);
    t.is(nonEof[0].type, 'IDENTIFIER');
    t.is(nonEof[0].value, 'ANDroid');
});

test('tokenizer treats IFFy as identifier, not IFF operator', t => {
    const tokens = tokenize('IFFy');
    const nonEof = tokens.filter(tok => tok.type !== 'EOF');
    t.is(nonEof.length, 1);
    t.is(nonEof[0].type, 'IDENTIFIER');
    t.is(nonEof[0].value, 'IFFy');
});

test('tokenizer still recognizes NOT as operator when standalone', t => {
    const tokens = tokenize('NOT A');
    const nonEof = tokens.filter(tok => tok.type !== 'EOF');
    t.is(nonEof.length, 2);
    t.is(nonEof[0].type, 'OPERATOR');
    t.is(nonEof[0].value, 'not');
    t.is(nonEof[1].type, 'IDENTIFIER');
    t.is(nonEof[1].value, 'A');
});

// Token.toString
//

test('Token toString formats correctly', t => {
    const tok = new Token(LexerTokenType.IDENTIFIER, 'Foo', 5);
    t.is(tok.toString(), `Token(IDENTIFIER, 'Foo', 5)`);
});

// FormulaLexer.peek
//

test('FormulaLexer peek returns next character without advancing', t => {
    const lexer = new FormulaLexer('AB');
    t.is(lexer.peek(), 'B');
    t.is(lexer.current_char, 'A');
});

test('FormulaLexer peek returns null at end of input', t => {
    const lexer = new FormulaLexer('A');
    t.is(lexer.peek(), null);
});

// FormulaLexer error paths
//

test('FormulaLexer readIdentifier throws on non-letter start', t => {
    const lexer = new FormulaLexer('A');
    lexer.position = 0;
    lexer.current_char = '9';
    t.throws(() => {
        lexer.readIdentifier();
    }, { message: /Invalid identifier start character/ });
});

test('FormulaLexer readOperator throws for unknown operator char', t => {
    const lexer = new FormulaLexer('#');
    // '#' is not in OPERATOR_MAPPINGS and startsOperator would return false,
    // but if we call readOperator directly it should throw
    //
    t.throws(() => {
        lexer.readOperator();
    }, { message: /Unknown operator/ });
});

