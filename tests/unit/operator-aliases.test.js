import test from 'ava';
import { runGentzenReasoning } from '../../main.js';
import { join } from 'node:path';
import fs from 'fs-extra';
import os from 'node:os';
import { validateProof } from '../helpers/validateProof.js';

// Helper to create temporary scenario files for testing
//
async function createTempScenario(scenarioContent) {
    const tempDir = await fs.mkdtemp(join(os.tmpdir(), 'gentzen-operator-test-'));
    const scenarioPath = join(tempDir, 'test-scenario.yaml');
    await fs.writeFile(scenarioPath, scenarioContent);
    return { scenarioPath, tempDir };
}

// Helper to clean up temp files
//
async function cleanup(tempDir) {
    await fs.remove(tempDir);
}

// Test resolvers for operator alias tests
const testResolvers = {
    UserLoggedIn: () => true,
    SystemHealthy: () => true,
    HasPermission: () => true,
    MaintenanceMode: () => false,  // Creates ~MaintenanceMode
    EmergencyMode: () => false     // Creates ~EmergencyMode
};

test('AND operator aliases - all forms work in scenarios', async t => {
    const aliases = [
        { name: 'Unicode ∧', operator: '∧' },
        { name: 'Keyword AND', operator: 'AND' },
        { name: 'Symbol &', operator: '&' }
    ];

    for (const alias of aliases) {
        // Result is NOT declared as a proposition — that way its proof can
        // only come from the BFS firing MP on the compound proposition,
        // which gives derivation === 'inference'.
        //
        const scenarioContent = `
propositions:
  - ((UserLoggedIn ${alias.operator} SystemHealthy) → Result)

steps:
  - rule: alpha
    subtype: and
    from:
      - UserLoggedIn
      - SystemHealthy

targets:
  - (UserLoggedIn ${alias.operator} SystemHealthy)
  - Result
`;

        const { scenarioPath, tempDir } = await createTempScenario(scenarioContent);

        try {
            const results = await runGentzenReasoning(scenarioPath, {
                customResolvers: testResolvers
            });

            t.is(results.summary.provenTargets, 2, `${alias.name} should prove both targets`);
            t.true(results.targets[0].proven, `${alias.name} conjunction should be proven`);
            t.true(results.targets[1].proven, `${alias.name} result should be proven (via MP)`);
            t.is(results.targets[1].derivation, 'inference',
                `${alias.name} Result should be derived via MP, not asserted`);
            validateProof(t, results);
        } catch (error) {
            t.fail(`${alias.name} failed: ${error.message}`);
        } finally {
            await cleanup(tempDir);
        }
    }
});

test('OR operator aliases - all forms work in scenarios', async t => {
    const aliases = [
        { name: 'Unicode ∨', operator: '∨' },
        { name: 'Keyword OR', operator: 'OR' },
        { name: 'Symbol |', operator: '|' }
    ];

    for (const alias of aliases) {
        const scenarioContent = `
propositions:
  - Result

steps:
  - rule: beta
    from:
      - UserLoggedIn
      - SystemHealthy

targets:
  - (UserLoggedIn ${alias.operator} SystemHealthy)
`;

        const { scenarioPath, tempDir } = await createTempScenario(scenarioContent);
        
        try {
            const results = await runGentzenReasoning(scenarioPath, {
                customResolvers: testResolvers
            });

            t.is(results.summary.provenTargets, 1, `${alias.name} should prove target`);
            t.true(results.targets[0].proven, `${alias.name} disjunction should be proven`);
            validateProof(t, results);
        } catch (error) {
            t.fail(`${alias.name} failed: ${error.message}`);
        } finally {
            await cleanup(tempDir);
        }
    }
});

test('IMPLIES operator aliases - all forms parse to canonical implication', async t => {
    // Verifies parser normalizes each operator alias to → so a target written
    // with any alias matches a proposition declared with any other alias.
    //
    const aliases = [
        { name: 'Unicode →', operator: '→' },
        { name: 'Keyword IMPLIES', operator: 'IMPLIES' },
        { name: 'Symbol ->', operator: '->' }
    ];

    for (const alias of aliases) {
        const scenarioContent = `
propositions:
  - (UserLoggedIn ${alias.operator} Result)

targets:
  - (UserLoggedIn → Result)
`;

        const { scenarioPath, tempDir } = await createTempScenario(scenarioContent);

        try {
            const results = await runGentzenReasoning(scenarioPath, {
                customResolvers: testResolvers
            });

            t.is(results.summary.provenTargets, 1, `${alias.name} should prove target`);
            t.true(results.targets[0].proven, `${alias.name} implication should be proven`);
            validateProof(t, results);
        } catch (error) {
            t.fail(`${alias.name} failed: ${error.message}`);
        } finally {
            await cleanup(tempDir);
        }
    }
});

test('EQUIVALENCE operator aliases - all forms parse to canonical biconditional', async t => {
    const aliases = [
        { name: 'Unicode ↔', operator: '↔' },
        { name: 'Keyword IFF', operator: 'IFF' },
        { name: 'Symbol <->', operator: '<->' }
    ];

    for (const alias of aliases) {
        const scenarioContent = `
propositions:
  - (UserLoggedIn ${alias.operator} SystemHealthy)

targets:
  - (UserLoggedIn ↔ SystemHealthy)
`;

        const { scenarioPath, tempDir } = await createTempScenario(scenarioContent);

        try {
            const results = await runGentzenReasoning(scenarioPath, {
                customResolvers: testResolvers
            });

            t.is(results.summary.provenTargets, 1, `${alias.name} should prove target`);
            t.true(results.targets[0].proven, `${alias.name} equivalence should be proven`);
            validateProof(t, results);
        } catch (error) {
            t.fail(`${alias.name} failed: ${error.message}`);
        } finally {
            await cleanup(tempDir);
        }
    }
});

test('Mixed operator aliases in complex formula', async t => {
    const scenarioContent = `
propositions:
  - AgentCanRun
  # Implication stipulated as a proposition; MP fires automatically when the antecedent is derived.
  - ((((UserLoggedIn AND HasPermission) ∧ ~MaintenanceMode) OR ~EmergencyMode) → AgentCanRun)

steps:
  # Build complex condition using different aliases
  - rule: alpha
    subtype: and
    from:
      - UserLoggedIn
      - HasPermission

  - rule: alpha
    subtype: and
    from:
      - (UserLoggedIn AND HasPermission)
      - ~MaintenanceMode

  # Create disjunction with different alias
  - rule: beta
    from:
      - ((UserLoggedIn AND HasPermission) ∧ ~MaintenanceMode)
      - ~EmergencyMode

targets:
  - (UserLoggedIn AND HasPermission)
  - ((UserLoggedIn AND HasPermission) ∧ ~MaintenanceMode)
  - (((UserLoggedIn AND HasPermission) ∧ ~MaintenanceMode) OR ~EmergencyMode)
  - AgentCanRun
`;

    const { scenarioPath, tempDir } = await createTempScenario(scenarioContent);
    
    try {
        const results = await runGentzenReasoning(scenarioPath, {
            customResolvers: testResolvers
        });

        t.is(results.summary.provenTargets, 4, 'All mixed alias targets should be proven');
        results.targets.forEach((target, i) => {
            t.true(target.proven, `Target ${i + 1} with mixed aliases should be proven: ${target.formula}`);
        });
        validateProof(t, results);
    } catch (error) {
        t.fail(`Mixed aliases failed: ${error.message}`);
    } finally {
        await cleanup(tempDir);
    }
});

test('Contraposition with operator aliases', async t => {
    const scenarioContent = `
propositions:
  - ActionAllowed
  - (UserLoggedIn IMPLIES ActionAllowed)

steps:
  # Apply contraposition to the keyword-aliased proposition
  - rule: contraposition
    from:
      - (UserLoggedIn IMPLIES ActionAllowed)

targets:
  - (UserLoggedIn IMPLIES ActionAllowed)
  - (~ActionAllowed IMPLIES ~UserLoggedIn)
`;

    const { scenarioPath, tempDir } = await createTempScenario(scenarioContent);
    
    try {
        const results = await runGentzenReasoning(scenarioPath, {
            customResolvers: testResolvers
        });

        t.is(results.summary.provenTargets, 2, 'Both contraposition targets should be proven');
        t.true(results.targets[0].proven, 'Original implication should be proven');
        t.true(results.targets[1].proven, 'Contrapositive should be proven');
        validateProof(t, results);
    } catch (error) {
        t.fail(`Contraposition with aliases failed: ${error.message}`);
    } finally {
        await cleanup(tempDir);
    }
});

test('Agent authorization scenario with readable aliases', async t => {
    // Real-world use case: agent pre-condition validation. Authorization rule is
    // stipulated as a compound proposition; alpha-AND lifts atomic facts into
    // the compound antecedent; MP fires automatically.
    const scenarioContent = `
propositions:
  - AgentAuthorized
  - SafeToRun
  - (((UserLoggedIn AND SystemHealthy) AND (~MaintenanceMode AND ~EmergencyMode)) → AgentAuthorized)

steps:
  # User authentication and system health check
  - rule: alpha
    subtype: and
    from:
      - UserLoggedIn
      - SystemHealthy

  # System safety check
  - rule: alpha
    subtype: and
    from:
      - ~MaintenanceMode
      - ~EmergencyMode

  # Combined safety condition - matches the proposition's antecedent
  - rule: alpha
    subtype: and
    from:
      - (UserLoggedIn AND SystemHealthy)
      - (~MaintenanceMode AND ~EmergencyMode)

targets:
  - (UserLoggedIn AND SystemHealthy)
  - (~MaintenanceMode AND ~EmergencyMode)
  - ((UserLoggedIn AND SystemHealthy) AND (~MaintenanceMode AND ~EmergencyMode))
  - AgentAuthorized
`;

    const { scenarioPath, tempDir } = await createTempScenario(scenarioContent);
    
    try {
        const results = await runGentzenReasoning(scenarioPath, {
            customResolvers: testResolvers
        });

        t.is(results.summary.provenTargets, 4, 'All agent authorization conditions should be proven');
        t.true(results.targets[3].proven, 'Agent should be authorized when all conditions are met');

        // Verify no missing facts - this is critical for agent systems
        results.targets.forEach(target => {
            t.is(target.missingFacts.length, 0, `No missing facts for: ${target.formula}`);
        });
        validateProof(t, results);
    } catch (error) {
        t.fail(`Agent authorization scenario failed: ${error.message}`);
    } finally {
        await cleanup(tempDir);
    }
});

test('Operator normalization consistency', async t => {
    // Test that equivalent formulas using different aliases produce same results
    const scenarios = [
        {
            name: 'Unicode operators',
            content: 'targets:\n  - (UserLoggedIn ∧ SystemHealthy)\n  - (UserLoggedIn → HasPermission)'
        },
        {
            name: 'Keyword operators', 
            content: 'targets:\n  - (UserLoggedIn AND SystemHealthy)\n  - (UserLoggedIn IMPLIES HasPermission)'
        },
        {
            name: 'Symbol operators',
            content: 'targets:\n  - (UserLoggedIn & SystemHealthy)\n  - (UserLoggedIn -> HasPermission)'
        }
    ];

    const results = [];
    
    for (const scenario of scenarios) {
        const { scenarioPath, tempDir } = await createTempScenario(scenario.content);
        
        try {
            const result = await runGentzenReasoning(scenarioPath, {
                customResolvers: testResolvers
            });
            results.push(result);
        } catch (error) {
            t.fail(`${scenario.name} failed: ${error.message}`);
        } finally {
            await cleanup(tempDir);
        }
    }

    // All scenarios should produce equivalent results
    t.is(results.length, 3, 'All three operator styles should work');
    
    // Check that results are consistent across operator styles
    const firstResult = results[0];
    results.forEach((result, i) => {
        t.is(result.summary.provenTargets, firstResult.summary.provenTargets, 
            `Result ${i} should have same number of proven targets`);
        t.is(result.targets.length, firstResult.targets.length,
            `Result ${i} should have same number of targets`);
    });
});