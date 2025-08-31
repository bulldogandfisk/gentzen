import { parseFormula } from '../gentzen.js';
import { getAtoms } from './formulaAST.js';

// Normalize a formula string using AST parsing
export function normalizeFormula(formula) {
    const parsed = parseFormula(formula);
    return parsed.toString();
}

// Extract atoms from a formula using AST parsing
export function extractFormulaAtoms(formula) {
    const parsed = parseFormula(formula);
    return Array.from(getAtoms(parsed.ast));
}

// Extract atoms from a formula and add them to a set (for collecting atoms)
export function addFormulaAtomsToSet(formula, atomSet) {
    const parsed = parseFormula(formula);
    const atoms = getAtoms(parsed.ast);
    atoms.forEach(atom => atomSet.add(atom));
}

// Strip all leading "~~" to get the canonical form of a formula
export function canonicalDoubleNeg(formula) {
    let result = formula;
    while (result.startsWith('~~')) {
        result = result.slice(2);
    }
    return result;
}


// Extract atoms with base names for missing fact reporting
export function extractMissingFactsFromFormula(formula, isAtomResolvableCallback) {
    const parsed = parseFormula(formula);
    const atoms = getAtoms(parsed.ast);
    const missing = [];
    for (const atom of atoms) {
        if (!isAtomResolvableCallback(atom)) {
            // Extract base name for reporting
            const baseName = atom.replace(/^~+/, '');
            missing.push(baseName);
        }
    }
    return { canResolve: missing.length === 0, missing };
}