import { parseFormulaFromString } from './formulaParser.js';
import { normalizeAST, astToString as astToStringImpl, getAtoms } from './formulaAST.js';
import { getConfigSection } from './config.js';

// LRU cache for normalized formula results.
// Avoids re-parsing identical formula strings in hot paths
// like isProved() and findStepsContaining(). Map preserves insertion
// order; on a hit we re-insert the entry to mark it most-recent.
//
const _normalizeCache = new Map();

function getCacheLimit() {
    const config = getConfigSection('performance') || {};
    return config.cacheSize || 1000;
}

// Normalize a formula string using AST parsing (cached).
//
export function normalizeFormula(formula) {
    const cached = _normalizeCache.get(formula);
    if (cached !== undefined) {
        _normalizeCache.delete(formula);
        _normalizeCache.set(formula, cached);
        return cached;
    }
    const ast = parseFormulaFromString(formula);
    const normalized = normalizeAST(ast);
    const result = astToStringImpl(normalized);

    if (_normalizeCache.size >= getCacheLimit()) {
        const oldestKey = _normalizeCache.keys().next().value;
        _normalizeCache.delete(oldestKey);
    }
    _normalizeCache.set(formula, result);
    return result;
}

// Extract atoms from a formula using AST parsing
//
export function extractFormulaAtoms(formula) {
    const ast = normalizeAST(parseFormulaFromString(formula));
    return Array.from(getAtoms(ast));
}

// Extract atoms from a formula and add them to a set (for collecting atoms).
// Silently skips unparseable formulas so that scenario-level atom collection
// can survive a malformed step; the malformed formula will be surfaced later
// by the step processor as a parse_error skip.
//
export function addFormulaAtomsToSet(formula, atomSet) {
    let ast;
    try {
        ast = normalizeAST(parseFormulaFromString(formula));
    } catch {
        return;
    }
    const atoms = getAtoms(ast);
    atoms.forEach(atom => atomSet.add(atom));
}

// Clear the normalization cache (for test isolation and long-lived processes)
//
export function clearNormalizeCache() {
    _normalizeCache.clear();
}

// Strip all leading "~~" to get the canonical form of a formula
//
export function canonicalDoubleNeg(formula) {
    let result = formula;
    while (result.startsWith('~~')) {
        result = result.slice(2);
    }
    return result;
}

// Extract atoms with base names for missing fact reporting
//
export function extractMissingFactsFromFormula(formula, isAtomResolvableCallback) {
    const ast = normalizeAST(parseFormulaFromString(formula));
    const atoms = getAtoms(ast);
    const missing = [];
    for (const atom of atoms) {
        if (!isAtomResolvableCallback(atom)) {
            const baseName = atom.replace(/^~+/, '');
            missing.push(baseName);
        }
    }
    return { canResolve: missing.length === 0, missing };
}
