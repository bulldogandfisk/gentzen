// operators.js
// Single source of truth for logical operators. The lexer normalizes
// every alias to a canonical name; the parser matches against canonical
// names; the AST printer maps canonical names back to display symbols.
// Adding a new operator means editing this table only.
//

export const OPERATORS = {
    NOT:     { canonical: 'not',     symbol: '~', aliases: ['~', 'NOT', '!'] },
    AND:     { canonical: 'and',     symbol: '∧', aliases: ['∧', 'AND', '&'] },
    OR:      { canonical: 'or',      symbol: '∨', aliases: ['∨', 'OR', '|'] },
    IMPLIES: { canonical: 'implies', symbol: '→', aliases: ['→', 'IMPLIES', '->', '=>'] },
    IFF:     { canonical: 'iff',     symbol: '↔', aliases: ['↔', 'IFF', '<->', '<=>'] }
};

// alias → canonical name. The lexer uses this to normalize input.
//
export const ALIAS_TO_CANONICAL = Object.fromEntries(
    Object.values(OPERATORS).flatMap(op => op.aliases.map(a => [a, op.canonical]))
);

// canonical name → display symbol. The AST printer uses this.
//
export const CANONICAL_TO_SYMBOL = Object.fromEntries(
    Object.values(OPERATORS).map(op => [op.canonical, op.symbol])
);

// Canonical names exposed as a keyed enum (CANONICAL.AND === 'and'). The
// parser uses these constants instead of string literals; OperatorType in
// formulaAST.js is an alias for this.
//
export const CANONICAL = Object.fromEntries(
    Object.entries(OPERATORS).map(([key, op]) => [key, op.canonical])
);
