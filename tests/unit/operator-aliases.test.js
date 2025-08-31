import test from 'ava';
import { runGentzenReasoning } from '../../main.js';
import { join } from 'node:path';
import fs from 'fs';
import os from 'os';

// Helper to create temporary scenario files for testing
function createTempScenario(scenarioContent) {
    const tempDir = fs.mkdtempSync(join(os.tmpdir(), 'gentzen-operator-test-'));
    const scenarioPath = join(tempDir, 'test-scenario.yaml');
    fs.writeFileSync(scenarioPath, scenarioContent);
    return { scenarioPath, tempDir };
}

// Helper to clean up temp files
function cleanup(tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
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
        const scenarioContent = `
propositions:
  - Result

steps:
  - rule: alpha
    subtype: and
    from:
      - UserLoggedIn
      - SystemHealthy

  - rule: alpha
    subtype: implies
    from:
      - (UserLoggedIn ${alias.operator} SystemHealthy)
      - Result

targets:
  - (UserLoggedIn ${alias.operator} SystemHealthy)
  - Result
`;

        const { scenarioPath, tempDir } = createTempScenario(scenarioContent);
        
        try {
            const results = await runGentzenReasoning(scenarioPath, {
                customResolvers: testResolvers
            });

            t.is(results.summary.provenTargets, 2, `${alias.name} should prove both targets`);
            t.true(results.targets[0].proven, `${alias.name} conjunction should be proven`);
            t.true(results.targets[1].proven, `${alias.name} result should be proven`);
        } catch (error) {
            t.fail(`${alias.name} failed: ${error.message}`);
        } finally {
            cleanup(tempDir);
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

        const { scenarioPath, tempDir } = createTempScenario(scenarioContent);
        
        try {
            const results = await runGentzenReasoning(scenarioPath, {
                customResolvers: testResolvers
            });

            t.is(results.summary.provenTargets, 1, `${alias.name} should prove target`);
            t.true(results.targets[0].proven, `${alias.name} disjunction should be proven`);
        } catch (error) {
            t.fail(`${alias.name} failed: ${error.message}`);
        } finally {
            cleanup(tempDir);
        }
    }
});

test('IMPLIES operator aliases - all forms work in scenarios', async t => {
    const aliases = [
        { name: 'Unicode →', operator: '→' },
        { name: 'Keyword IMPLIES', operator: 'IMPLIES' },
        { name: 'Symbol ->', operator: '->' }
    ];

    for (const alias of aliases) {
        const scenarioContent = `
propositions:
  - Result

steps:
  - rule: alpha
    subtype: implies
    from:
      - UserLoggedIn
      - Result

targets:
  - (UserLoggedIn ${alias.operator} Result)
`;

        const { scenarioPath, tempDir } = createTempScenario(scenarioContent);
        
        try {
            const results = await runGentzenReasoning(scenarioPath, {
                customResolvers: testResolvers
            });

            t.is(results.summary.provenTargets, 1, `${alias.name} should prove target`);
            t.true(results.targets[0].proven, `${alias.name} implication should be proven`);
        } catch (error) {
            t.fail(`${alias.name} failed: ${error.message}`);
        } finally {
            cleanup(tempDir);
        }
    }
});

test('EQUIVALENCE operator aliases - all forms work in scenarios', async t => {
    const aliases = [
        { name: 'Unicode ↔', operator: '↔' },
        { name: 'Keyword IFF', operator: 'IFF' },
        { name: 'Symbol <->', operator: '<->' }
    ];

    for (const alias of aliases) {
        const scenarioContent = `
propositions:
  - Result

steps:
  - rule: equivalence
    from:
      - UserLoggedIn
      - SystemHealthy

targets:
  - (UserLoggedIn ${alias.operator} SystemHealthy)
`;

        const { scenarioPath, tempDir } = createTempScenario(scenarioContent);
        
        try {
            const results = await runGentzenReasoning(scenarioPath, {
                customResolvers: testResolvers
            });

            t.is(results.summary.provenTargets, 1, `${alias.name} should prove target`);
            t.true(results.targets[0].proven, `${alias.name} equivalence should be proven`);
        } catch (error) {
            t.fail(`${alias.name} failed: ${error.message}`);
        } finally {
            cleanup(tempDir);
        }
    }
});

test('Mixed operator aliases in complex formula', async t => {
    const scenarioContent = `
propositions:
  - AgentCanRun

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

  # Create implication with different alias  
  - rule: alpha
    subtype: implies
    from:
      - (((UserLoggedIn AND HasPermission) ∧ ~MaintenanceMode) OR ~EmergencyMode)
      - AgentCanRun

targets:
  - (UserLoggedIn AND HasPermission)
  - ((UserLoggedIn AND HasPermission) ∧ ~MaintenanceMode)
  - (((UserLoggedIn AND HasPermission) ∧ ~MaintenanceMode) OR ~EmergencyMode)
  - AgentCanRun
`;

    const { scenarioPath, tempDir } = createTempScenario(scenarioContent);
    
    try {
        const results = await runGentzenReasoning(scenarioPath, {
            customResolvers: testResolvers
        });

        t.is(results.summary.provenTargets, 4, 'All mixed alias targets should be proven');
        results.targets.forEach((target, i) => {
            t.true(target.proven, `Target ${i + 1} with mixed aliases should be proven: ${target.formula}`);
        });
    } catch (error) {
        t.fail(`Mixed aliases failed: ${error.message}`);
    } finally {
        cleanup(tempDir);
    }
});

test('Contraposition with operator aliases', async t => {
    const scenarioContent = `
propositions:
  - ActionAllowed

steps:
  # Create implication using keyword alias
  - rule: alpha
    subtype: implies
    from:
      - UserLoggedIn
      - ActionAllowed

  # Apply contraposition to the keyword-based implication
  - rule: contraposition
    from:
      - (UserLoggedIn IMPLIES ActionAllowed)

targets:
  - (UserLoggedIn IMPLIES ActionAllowed)
  - (~ActionAllowed IMPLIES ~UserLoggedIn)
`;

    const { scenarioPath, tempDir } = createTempScenario(scenarioContent);
    
    try {
        const results = await runGentzenReasoning(scenarioPath, {
            customResolvers: testResolvers
        });

        t.is(results.summary.provenTargets, 2, 'Both contraposition targets should be proven');
        t.true(results.targets[0].proven, 'Original implication should be proven');
        t.true(results.targets[1].proven, 'Contrapositive should be proven');
    } catch (error) {
        t.fail(`Contraposition with aliases failed: ${error.message}`);
    } finally {
        cleanup(tempDir);
    }
});

test('Agent authorization scenario with readable aliases', async t => {
    // This tests the real-world use case: agent pre-condition validation using readable operators
    const scenarioContent = `
propositions:
  - AgentAuthorized
  - SafeToRun

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

  # Combined safety condition
  - rule: alpha
    subtype: and
    from:
      - (UserLoggedIn AND SystemHealthy)
      - (~MaintenanceMode AND ~EmergencyMode)

  # Authorization rule: if all conditions met, agent is authorized
  - rule: alpha
    subtype: implies
    from:
      - ((UserLoggedIn AND SystemHealthy) AND (~MaintenanceMode AND ~EmergencyMode))
      - AgentAuthorized

targets:
  - (UserLoggedIn AND SystemHealthy)
  - (~MaintenanceMode AND ~EmergencyMode)  
  - ((UserLoggedIn AND SystemHealthy) AND (~MaintenanceMode AND ~EmergencyMode))
  - AgentAuthorized
`;

    const { scenarioPath, tempDir } = createTempScenario(scenarioContent);
    
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
    } catch (error) {
        t.fail(`Agent authorization scenario failed: ${error.message}`);
    } finally {
        cleanup(tempDir);
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
        const { scenarioPath, tempDir } = createTempScenario(scenario.content);
        
        try {
            const result = await runGentzenReasoning(scenarioPath, {
                customResolvers: testResolvers
            });
            results.push(result);
        } catch (error) {
            t.fail(`${scenario.name} failed: ${error.message}`);
        } finally {
            cleanup(tempDir);
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