// test-helpers.js - Helper functions for AVA tests to replace custom assertions

// Domain-specific assertion helpers for Gentzen tests
export function assertProven(t, target, results, message = `Expected target '${target}' to be proven`) {
	const targetResult = results.targets.find(tr => tr.formula === target);
	if (!targetResult) {
		t.fail(`Target '${target}' not found in results`);
		return;
	}
	t.true(targetResult.proven, message);
}

export function assertNotProven(t, target, results, message = `Expected target '${target}' to not be proven`) {
	const targetResult = results.targets.find(tr => tr.formula === target);
	if (targetResult && targetResult.proven) {
		t.fail(message);
	} else {
		t.pass();
	}
}

export function assertMissingFacts(t, expectedMissing, results, message = 'Expected missing facts do not match') {
	const actualMissing = results.missingFacts || [];
	for (const fact of expectedMissing) {
		t.true(actualMissing.includes(fact), `Expected missing fact '${fact}' not found`);
	}
}

export function assertResolverLoaded(t, resolverName, results, message = `Expected resolver '${resolverName}' to be loaded`) {
	// For new system, we check if any resolver functions match the expected type
	const factResolutions = results.factResolutions || {};
	const resolverNames = Object.keys(factResolutions);
	
	let hasResolverType = false;
	
	if (resolverName === 'travel') {
		hasResolverType = resolverNames.some(name => name.includes('Travel') || name.includes('User') || name.includes('Visa') || name.includes('European'));
	} else if (resolverName === 'business') {
		hasResolverType = resolverNames.some(name => name.includes('Customer') || name.includes('Order') || name.includes('Payment') || name.includes('VIP'));
	} else if (resolverName === 'system') {
		hasResolverType = resolverNames.some(name => name.includes('System') || name.includes('Database') || name.includes('Security') || name.includes('Backup'));
	} else if (resolverName === 'time') {
		hasResolverType = resolverNames.some(name => name.startsWith('Is') && (name.includes('Business') || name.includes('Weekend') || name.includes('Holiday') || name.includes('Hours')));
	} else {
		// Fallback to original behavior for other resolver names
		hasResolverType = resolverNames.some(name => name.toLowerCase().includes(resolverName.toLowerCase()));
	}
	
	t.true(hasResolverType, message);
}

export function assertScenarioStructure(t, results, message = 'Results do not have expected structure') {
	const requiredFields = ['scenarioPath', 'targets', 'summary', 'availableFacts', 'missingFacts'];
	for (const field of requiredFields) {
		t.true(field in results, `Missing required field '${field}'`);
	}
	
	t.true(Array.isArray(results.targets), 'targets should be an array');
	t.true(results.summary && typeof results.summary === 'object', 'summary should be an object');
}

export function assertFactResolved(t, factName, results, message = `Expected fact '${factName}' to be resolved`) {
	const factResolutions = results.factResolutions || {};
	t.true(factName in factResolutions, `Fact '${factName}' not in resolutions`);
	t.true(factResolutions[factName], message);
}

export function assertFactNotResolved(t, factName, results, message = `Expected fact '${factName}' to not be resolved`) {
	const factResolutions = results.factResolutions || {};
	t.falsy(factResolutions[factName], message);
}

export function assertStepSkipped(t, stepIndex, results, message = `Expected step ${stepIndex} to be skipped`) {
	const skippedSteps = results.skippedSteps || [];
	const isSkipped = skippedSteps.some(step => step.stepIndex === stepIndex);
	t.true(isSkipped, message);
}

export function assertSummaryStats(t, results, expectedStats, message = 'Summary stats do not match expected') {
	const { summary } = results;
	for (const [key, expected] of Object.entries(expectedStats)) {
		t.is(summary[key], expected, `Summary.${key} mismatch: expected ${expected}, got ${summary[key]}`);
	}
}

export function assertArrayContains(t, array, item, message = `Expected array to contain ${item}`) {
	t.true(Array.isArray(array), 'First argument should be an array');
	t.true(array.includes(item), message);
}

export function assertArrayNotContains(t, array, item, message = `Expected array to not contain ${item}`) {
	if (Array.isArray(array)) {
		t.false(array.includes(item), message);
	} else {
		t.pass(); // Not an array, so it doesn't contain the item
	}
}

export function assertContains(t, str, substring, message = `Expected string to contain '${substring}'`) {
	t.true(typeof str === 'string', 'First argument should be a string');
	t.true(str.includes(substring), message);
}
