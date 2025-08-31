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

// Integration tests with existing scenarios
test('parser handles formulas from existing scenarios', t => {
    const formulas = [
        'CustomerIsVIP',
        'PaymentProcessed', 
        '(CustomerIsVIP ∧ PaymentProcessed)',
        'ProcessOrder',
        'SystemHealthy',
        'IsBusinessHours',
        '(SystemHealthy ∧ IsBusinessHours)',
        'ScheduleMaintenance',
        '~UserHasPermission',
        'SecurityCheckPassed',
        '(~UserHasPermission ∧ SecurityCheckPassed)',
        'AccessDenied',
        'UserIsGuest',
        '~MaintenanceMode',
        '(UserIsGuest ∧ ~MaintenanceMode)',
        'AllowGuestAccess',
        'SystemAvailable',
        '(~UserHasPermission → AccessDenied)',
        '(UserIsGuest ∧ ~MaintenanceMode)'
    ];
    
    for (const formula of formulas) {
        const result = parseFormula(formula);
        t.truthy(result);
        t.truthy(result.ast, `Failed to parse: ${formula}`);
        t.is(typeof result.toString(), 'string');
    }
});