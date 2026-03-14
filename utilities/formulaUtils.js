import { parseFormula } from '../gentzen.js';
import { getAtoms } from './formulaAST.js';
import { getConfigSection } from './config.js';

// LRU-style cache for parsed formula results.
// Avoids re-parsing identical formula strings in hot paths
// like isProved() and findStepsContaining().
//
const _normalizeCache = new Map();

function getCacheLimit() {
    const config = getConfigSection('performance') || {};
    return config.cacheSize || 1000;
}

// Normalize a formula string using AST parsing (cached)
//
export function normalizeFormula(formula) {
    const cached = _normalizeCache.get(formula);
    if (cached !== undefined) {
        return cached;
    }
    const parsed = parseFormula(formula);
    const result = parsed.toString();

    // Evict oldest entry if at capacity
    //
    if (_normalizeCache.size >= getCacheLimit()) {
        const firstKey = _normalizeCache.keys().next().value;
        _normalizeCache.delete(firstKey);
    }
    _normalizeCache.set(formula, result);
    return result;
}

// Extract atoms from a formula using AST parsing
//
export function extractFormulaAtoms(formula) {
    const parsed = parseFormula(formula);
    return Array.from(getAtoms(parsed.ast));
}

// Extract atoms from a formula and add them to a set (for collecting atoms)
//
export function addFormulaAtomsToSet(formula, atomSet) {
    const parsed = parseFormula(formula);
    const atoms = getAtoms(parsed.ast);
    atoms.forEach(atom => atomSet.add(atom));
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
    const parsed = parseFormula(formula);
    const atoms = getAtoms(parsed.ast);
    const missing = [];
    for (const atom of atoms) {
        if (!isAtomResolvableCallback(atom)) {
            const baseName = atom.replace(/^~+/, '');
            missing.push(baseName);
        }
    }
    return { canResolve: missing.length === 0, missing };
}
