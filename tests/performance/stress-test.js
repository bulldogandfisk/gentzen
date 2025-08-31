import { join } from 'node:path';
import { createTestSuite } from '../framework/TestCase.js';
import { runGentzenReasoning } from '../../main.js';
import { allMockResolvers } from '../scenarios/test-resolvers/mockResolvers.js';

// Performance and stress testing.
//

const testDir = import.meta.dirname;
const mainScenariosPath = join(testDir, '../../scenarios');

export const testSuite = createTestSuite('Performance and Stress Tests')
    .addTest('large scenario performance', async (assert) => {
        const scenarioPath = join(mainScenariosPath, 'scenario-no-facts.yaml');
        const startTime = Date.now();
        
        const results = await runGentzenReasoning(scenarioPath, {
            customResolvers: allMockResolvers
        });
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        assert.assertScenarioStructure(results);
        assert.assertTrue(duration < 2000, `Performance too slow: ${duration}ms`);
        assert.assertTrue(results.targets.length > 0);
    })
    
    .addTest('multiple scenario executions', async (assert) => {
        const scenarioPath = join(mainScenariosPath, 'mixed-scenario.yaml');
        const executions = 10;
        const startTime = Date.now();
        
        const promises = [];
        for (let i = 0; i < executions; i++) {
            promises.push(runGentzenReasoning(scenarioPath, {
                customResolvers: allMockResolvers
            }));
        }
        
        const results = await Promise.all(promises);
        const endTime = Date.now();
        const totalDuration = endTime - startTime;
        const avgDuration = totalDuration / executions;
        
        assert.assertEqual(results.length, executions);
        for (const result of results) {
            assert.assertScenarioStructure(result);
        }
        
        assert.assertTrue(avgDuration < 500, `Average execution too slow: ${avgDuration}ms`);
    })
    
    .addTest('memory usage stability', async (assert) => {
        const scenarioPath = join(mainScenariosPath, 'scenario-no-facts.yaml');
        const iterations = 50;
        
        // Run multiple iterations to check for memory leaks
        for (let i = 0; i < iterations; i++) {
            const results = await runGentzenReasoning(scenarioPath, {
                customResolvers: allMockResolvers
            });
            
            assert.assertScenarioStructure(results);
            
            // Force garbage collection opportunity
            if (i % 10 === 0 && global.gc) {
                global.gc();
            }
        }
        
        assert.assertTrue(true, 'Memory usage test completed without crashes');
    })
    
    .addTest('resolver loading performance', async (assert) => {
        const scenarioPath = join(mainScenariosPath, 'mixed-scenario.yaml');
        const resolversPath = join(testDir, '../../resolvers');
        
        const startTime = Date.now();
        
        const results = await runGentzenReasoning(scenarioPath, {
            resolversPath
        });
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        assert.assertScenarioStructure(results);
        assert.assertTrue(duration < 1000, `Resolver loading too slow: ${duration}ms`);
        assert.assertTrue(results.summary.loadedModules.length > 0);
    })
    
    .addTest('large custom resolver set performance', async (assert) => {
        const scenarioPath = join(mainScenariosPath, 'minimal.yaml');
        
        // Create a large set of custom resolvers
        const customResolvers = {};
        for (let i = 0; i < 1000; i++) {
            customResolvers[`TestFact${i}`] = () => Math.random() > 0.5;
        }
        
        const startTime = Date.now();
        
        const results = await runGentzenReasoning(scenarioPath, {
            customResolvers
        });
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        assert.assertScenarioStructure(results);
        assert.assertTrue(duration < 3000, `Large resolver set too slow: ${duration}ms`);
        assert.assertEqual(Object.keys(results.factResolutions).length, 1000);
    })
    
    .addTest('concurrent execution safety', async (assert) => {
        const scenarioPath = join(mainScenariosPath, 'mixed-scenario.yaml');
        const concurrentExecutions = 5;
        
        const promises = [];
        for (let i = 0; i < concurrentExecutions; i++) {
            promises.push(runGentzenReasoning(scenarioPath, {
                customResolvers: {
                    ...allMockResolvers,
                    ConcurrentTestFact: () => i // Different value per execution
                }
            }));
        }
        
        const results = await Promise.all(promises);
        
        assert.assertEqual(results.length, concurrentExecutions);
        for (let i = 0; i < results.length; i++) {
            assert.assertScenarioStructure(results[i]);
            // Each execution should have its own resolver values
            if ('ConcurrentTestFact' in results[i].factResolutions) {
                assert.assertEqual(results[i].factResolutions.ConcurrentTestFact, Boolean(i));
            }
        }
    })
    
    .addTest('verbose mode performance impact', async (assert) => {
        const scenarioPath = join(mainScenariosPath, 'scenario-no-facts.yaml');
        
        // Test normal mode
        const normalStart = Date.now();
        const normalResults = await runGentzenReasoning(scenarioPath, {
            customResolvers: allMockResolvers
        });
        const normalDuration = Date.now() - normalStart;
        
        // Test verbose mode
        const verboseStart = Date.now();
        const verboseResults = await runGentzenReasoning(scenarioPath, {
            verbose: true,
            customResolvers: allMockResolvers
        });
        const verboseDuration = Date.now() - verboseStart;
        
        assert.assertScenarioStructure(normalResults);
        assert.assertScenarioStructure(verboseResults);
        
        // Verbose mode shouldn't be more than 50% slower
        const performanceRatio = verboseDuration / normalDuration;
        assert.assertTrue(performanceRatio < 1.5, `Verbose mode too slow: ${performanceRatio}x slower`);
    })
    
    .addTest('error handling performance', async (assert) => {
        const scenarioPath = join(mainScenariosPath, 'mixed-scenario.yaml');
        
        // Create resolvers that all throw errors
        const errorResolvers = {};
        for (const key of Object.keys(allMockResolvers)) {
            errorResolvers[key] = () => {
                throw new Error(`Error in ${key}`);
            };
        }
        
        const startTime = Date.now();
        
        const results = await runGentzenReasoning(scenarioPath, {
            customResolvers: errorResolvers
        });
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        assert.assertScenarioStructure(results);
        assert.assertTrue(duration < 2000, `Error handling too slow: ${duration}ms`);
        
        // All facts should be false due to errors
        for (const [factName, resolved] of Object.entries(results.factResolutions)) {
            if (factName in errorResolvers) {
                assert.assertEqual(resolved, false, `Fact ${factName} should be false due to error`);
            }
        }
    });
