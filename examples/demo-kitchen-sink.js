#!/usr/bin/env node

// ============================================================================
// ENTERPRISE KITCHEN SINK DEMONSTRATION
// ============================================================================
//
// This demonstration script showcases the comprehensive "kitchen sink" example
// that exercises every logical construct supported by the Gentzen reasoning
// system. It serves as both a comprehensive test and educational reference.
//
// WHAT THIS DEMONSTRATES:
// - All logical rule types (alpha, beta, contraposition, doubleNegation, equivalence)
// - All operator formats (Unicode, text, ASCII)
// - Complex enterprise business logic patterns
// - Real-world fact resolution with external system simulation
// - Performance characteristics under complex reasoning loads
// - Error handling and graceful degradation scenarios
//
// RUN THIS DEMO:
// node examples/demo-kitchen-sink.js [--verbose] [--quiet] [--performance]
//
// ============================================================================

import { runGentzenReasoning, displayResults } from '../main.js';
import { enterpriseResolvers } from './resolvers/enterpriseResolvers.js';
import { createLogger } from '../utilities/logger.js';
import { getConfigSection } from '../utilities/config.js';
import chalk from 'chalk';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// Get current directory for relative path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ----------------------------------------------------------------------------
// COMMAND LINE ARGUMENT PROCESSING
// ----------------------------------------------------------------------------

const args = process.argv.slice(2);
const isVerbose = args.includes('--verbose') || args.includes('-v');
const isQuiet = args.includes('--quiet') || args.includes('-q');
const showPerformance = args.includes('--performance') || args.includes('-p');
const benchmarkMode = args.includes('--benchmark') || args.includes('-b');

// Configure logging based on command line options
if (isQuiet) {
    process.env.LOG_LEVEL = 'ERROR';
} else if (isVerbose) {
    process.env.LOG_LEVEL = 'DEBUG';
} else {
    process.env.LOG_LEVEL = 'INFO';
}

// Create logger instance
const logConfig = getConfigSection('logging');
const logger = createLogger(logConfig);

// ----------------------------------------------------------------------------
// DEMONSTRATION HEADER AND INTRODUCTION
// ----------------------------------------------------------------------------

function displayIntroduction() {
    console.log(chalk.bold.blue('\n🏢 ENTERPRISE KITCHEN SINK DEMONSTRATION'));
    console.log(chalk.blue('=' .repeat(60)));
    console.log(chalk.white('\nThis demonstration showcases ALL logical constructs supported'));
    console.log(chalk.white('by the Gentzen reasoning system in a realistic enterprise context.'));
    
    console.log(chalk.yellow('\n📋 LOGICAL CONSTRUCTS DEMONSTRATED:'));
    console.log(chalk.white('  • Conjunctions (AND) - Required condition combinations'));
    console.log(chalk.white('  • Implications (IMPLIES) - Business rule automation'));
    console.log(chalk.white('  • Disjunctions (OR) - Alternative pathways and fallbacks'));
    console.log(chalk.white('  • Contraposition - Risk assessment and compliance verification'));
    console.log(chalk.white('  • Double Negation - Logic normalization and cleanup'));
    console.log(chalk.white('  • Equivalence (IFF) - Bidirectional business relationships'));
    
    console.log(chalk.green('\n🔧 OPERATOR FORMATS USED:'));
    console.log(chalk.white('  • Unicode: ∧ ∨ → ↔ ~ (formal logic notation)'));
    console.log(chalk.white('  • Text: AND OR IMPLIES IFF NOT (readable in reviews)'));
    console.log(chalk.white('  • ASCII: & | -> <-> ! (ASCII-compatible environments)'));
    
    console.log(chalk.magenta('\n🏭 ENTERPRISE PATTERNS COVERED:'));
    console.log(chalk.white('  • Customer verification workflows'));
    console.log(chalk.white('  • Payment processing and fraud detection'));
    console.log(chalk.white('  • Regulatory compliance automation'));
    console.log(chalk.white('  • System health monitoring and scaling'));
    console.log(chalk.white('  • Business continuity and disaster recovery'));
    
    if (showPerformance) {
        console.log(chalk.cyan('\n⚡ PERFORMANCE METRICS ENABLED'));
        console.log(chalk.white('  Performance data will be collected and displayed.'));
    }
    
    if (benchmarkMode) {
        console.log(chalk.red('\n🏁 BENCHMARK MODE ENABLED'));
        console.log(chalk.white('  Multiple runs will be executed for performance analysis.'));
    }
    
    console.log(chalk.blue('\n' + '=' .repeat(60)));
}

// ----------------------------------------------------------------------------
// PERFORMANCE MONITORING UTILITIES
// ----------------------------------------------------------------------------

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            startTime: null,
            endTime: null,
            duration: null,
            memoryUsage: {
                start: null,
                end: null,
                peak: null
            },
            resolverCalls: 0,
            proofSteps: 0,
            targetsEvaluated: 0
        };
    }
    
    start() {
        this.metrics.startTime = Date.now();
        this.metrics.memoryUsage.start = process.memoryUsage();
        
        // Monitor memory usage during execution
        this.memoryMonitor = setInterval(() => {
            const current = process.memoryUsage();
            if (!this.metrics.memoryUsage.peak || 
                current.heapUsed > this.metrics.memoryUsage.peak.heapUsed) {
                this.metrics.memoryUsage.peak = current;
            }
        }, 100);
    }
    
    end(results) {
        this.metrics.endTime = Date.now();
        this.metrics.duration = this.metrics.endTime - this.metrics.startTime;
        this.metrics.memoryUsage.end = process.memoryUsage();
        
        if (this.memoryMonitor) {
            clearInterval(this.memoryMonitor);
        }
        
        // Extract performance data from results
        if (results) {
            this.metrics.targetsEvaluated = results.targets?.length || 0;
            this.metrics.proofSteps = results.system?.steps?.length || 0;
            this.metrics.resolverCalls = Object.keys(results.factResolutions || {}).length;
        }
    }
    
    displayMetrics() {
        console.log(chalk.cyan('\n⚡ PERFORMANCE METRICS'));
        console.log(chalk.cyan('-' .repeat(40)));
        
        console.log(chalk.white(`⏱️  Execution Time: ${this.metrics.duration}ms`));
        console.log(chalk.white(`🎯 Targets Evaluated: ${this.metrics.targetsEvaluated}`));
        console.log(chalk.white(`📊 Proof Steps Generated: ${this.metrics.proofSteps}`));
        console.log(chalk.white(`🔧 Resolver Calls: ${this.metrics.resolverCalls}`));
        
        if (this.metrics.memoryUsage.start && this.metrics.memoryUsage.end) {
            const startHeap = this.metrics.memoryUsage.start.heapUsed / 1024 / 1024;
            const endHeap = this.metrics.memoryUsage.end.heapUsed / 1024 / 1024;
            const peakHeap = this.metrics.memoryUsage.peak?.heapUsed / 1024 / 1024 || endHeap;
            
            console.log(chalk.white(`🧠 Memory Usage (Start): ${startHeap.toFixed(2)} MB`));
            console.log(chalk.white(`🧠 Memory Usage (End): ${endHeap.toFixed(2)} MB`));
            console.log(chalk.white(`🧠 Memory Usage (Peak): ${peakHeap.toFixed(2)} MB`));
            console.log(chalk.white(`📈 Memory Delta: ${(endHeap - startHeap).toFixed(2)} MB`));
        }
        
        // Performance analysis
        const targetTimePerMs = this.metrics.targetsEvaluated / this.metrics.duration;
        const stepsPerMs = this.metrics.proofSteps / this.metrics.duration;
        
        console.log(chalk.yellow(`\n📊 THROUGHPUT ANALYSIS:`));
        console.log(chalk.white(`   ${(targetTimePerMs * 1000).toFixed(2)} targets/second`));
        console.log(chalk.white(`   ${(stepsPerMs * 1000).toFixed(2)} proof steps/second`));
        
        // Performance rating
        let rating = 'Good';
        let ratingColor = chalk.green;
        
        if (this.metrics.duration > 5000) {
            rating = 'Slow';
            ratingColor = chalk.red;
        } else if (this.metrics.duration > 2000) {
            rating = 'Fair';
            ratingColor = chalk.yellow;
        }
        
        console.log(chalk.white(`🏆 Performance Rating: ${ratingColor(rating)}`));
    }
}

// ----------------------------------------------------------------------------
// DEMONSTRATION EXECUTION FUNCTIONS
// ----------------------------------------------------------------------------

async function runKitchenSinkDemo() {
    const scenarioPath = join(__dirname, 'scenarios', 'enterprise-kitchen-sink.yaml');
    
    logger.info('🚀 Starting Enterprise Kitchen Sink demonstration...');
    
    const performanceMonitor = showPerformance ? new PerformanceMonitor() : null;
    
    try {
        if (performanceMonitor) {
            performanceMonitor.start();
        }
        
        // Run the comprehensive reasoning scenario
        const results = await runGentzenReasoning(scenarioPath, {
            verbose: isVerbose,
            customResolvers: enterpriseResolvers,
            validate: true  // Enable validation for this comprehensive example
        });
        
        if (performanceMonitor) {
            performanceMonitor.end(results);
        }
        
        if (!isQuiet) {
            console.log(chalk.green('\n✅ REASONING EXECUTION COMPLETED'));
            console.log(chalk.blue('=' .repeat(60)));
            
            // Display comprehensive results
            displayResults(results, { verbose: isVerbose });
            
            // Show additional analysis
            displayResultsAnalysis(results);
        }
        
        if (performanceMonitor) {
            performanceMonitor.displayMetrics();
        }
        
        return results;
        
    } catch (error) {
        logger.error('❌ Kitchen Sink demonstration failed:', error.message);
        
        if (isVerbose) {
            console.error('Full error details:', error);
        }
        
        throw error;
    }
}

// ----------------------------------------------------------------------------
// RESULTS ANALYSIS AND EDUCATIONAL INSIGHTS
// ----------------------------------------------------------------------------

function displayResultsAnalysis(results) {
    console.log(chalk.yellow('\n📊 EDUCATIONAL ANALYSIS'));
    console.log(chalk.yellow('-' .repeat(40)));
    
    // Analyze target success rates
    const totalTargets = results.targets.length;
    const provenTargets = results.targets.filter(t => t.proven).length;
    const successRate = (provenTargets / totalTargets * 100).toFixed(1);
    
    console.log(chalk.white(`🎯 Target Analysis:`));
    console.log(chalk.white(`   Total Targets: ${totalTargets}`));
    console.log(chalk.white(`   Proven Targets: ${provenTargets}`));
    console.log(chalk.white(`   Success Rate: ${successRate}%`));
    
    // Categorize targets by logical construct
    const targetCategories = categorizeTargets(results.targets);
    console.log(chalk.white(`\n🔍 Targets by Logical Construct:`));
    for (const [category, targets] of Object.entries(targetCategories)) {
        const proven = targets.filter(t => t.proven).length;
        console.log(chalk.white(`   ${category}: ${proven}/${targets.length} proven`));
    }
    
    // Analyze fact resolution patterns
    const factResolutions = results.factResolutions;
    const totalFacts = Object.keys(factResolutions).length;
    const resolvedFacts = Object.values(factResolutions).filter(Boolean).length;
    const factSuccessRate = (resolvedFacts / totalFacts * 100).toFixed(1);
    
    console.log(chalk.white(`\n🔧 Fact Resolution Analysis:`));
    console.log(chalk.white(`   Total Facts: ${totalFacts}`));
    console.log(chalk.white(`   Resolved Facts: ${resolvedFacts}`));
    console.log(chalk.white(`   Resolution Rate: ${factSuccessRate}%`));
    
    // System health insights
    if (results.system) {
        console.log(chalk.white(`\n🏗️  Proof System Analysis:`));
        console.log(chalk.white(`   Proof Steps Generated: ${results.system.steps.length}`));
        console.log(chalk.white(`   Available Facts: ${results.availableFacts.length}`));
        console.log(chalk.white(`   Missing Facts: ${results.missingFacts.length}`));
        console.log(chalk.white(`   Skipped Steps: ${results.skippedSteps.length}`));
    }
    
    // Business impact insights
    displayBusinessInsights(results);
}

function categorizeTargets(targets) {
    const categories = {
        'Conjunctions (AND)': [],
        'Implications (IMPLIES)': [],
        'Disjunctions (OR)': [],
        'Contraposition': [],
        'Double Negation': [],
        'Equivalence (IFF)': [],
        'Simple Propositions': []
    };
    
    targets.forEach(target => {
        const formula = target.formula;
        
        if (formula.includes('∧') || formula.includes('AND') || formula.includes('&')) {
            categories['Conjunctions (AND)'].push(target);
        } else if (formula.includes('→') || formula.includes('IMPLIES') || formula.includes('->')) {
            categories['Implications (IMPLIES)'].push(target);
        } else if (formula.includes('∨') || formula.includes('OR') || formula.includes('|')) {
            categories['Disjunctions (OR)'].push(target);
        } else if (formula.includes('↔') || formula.includes('IFF') || formula.includes('<->')) {
            categories['Equivalence (IFF)'].push(target);
        } else if (formula.includes('~~')) {
            categories['Double Negation'].push(target);
        } else if (formula.includes('~') && formula.includes('→')) {
            categories['Contraposition'].push(target);
        } else {
            categories['Simple Propositions'].push(target);
        }
    });
    
    return categories;
}

function displayBusinessInsights(results) {
    console.log(chalk.magenta('\n🏢 BUSINESS IMPACT ANALYSIS'));
    console.log(chalk.magenta('-' .repeat(40)));
    
    // Check key business outcomes
    const businessOutcomes = [
        'ProcessOrder',
        'RequireManualReview', 
        'ApplyFraudHold',
        'InitiateAMLCheck',
        'ScaleInfrastructure'
    ];
    
    console.log(chalk.white('🎯 Key Business Outcomes:'));
    businessOutcomes.forEach(outcome => {
        const target = results.targets.find(t => t.formula === outcome);
        if (target) {
            const status = target.proven ? '✅' : '❌';
            console.log(chalk.white(`   ${status} ${outcome}`));
        }
    });
    
    // Risk assessment
    const riskIndicators = results.factResolutions;
    console.log(chalk.white('\n⚠️  Risk Assessment:'));
    console.log(chalk.white(`   High Risk Transaction: ${riskIndicators.HighRiskTransaction ? '🔴 YES' : '🟢 NO'}`));
    console.log(chalk.white(`   Fraud Hold Applied: ${riskIndicators.ApplyFraudHold ? '🔴 YES' : '🟢 NO'}`));
    console.log(chalk.white(`   Manual Review Required: ${riskIndicators.RequireManualReview ? '🟡 YES' : '🟢 NO'}`));
    
    // System health
    console.log(chalk.white('\n🏥 System Health:'));
    console.log(chalk.white(`   Primary Systems: ${riskIndicators.PrimarySystemsOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}`));
    console.log(chalk.white(`   Database: ${riskIndicators.DatabaseConnected ? '🟢 CONNECTED' : '🔴 DISCONNECTED'}`));
    console.log(chalk.white(`   System Load: ${riskIndicators.SystemUnderHighLoad ? '🔴 HIGH' : '🟢 NORMAL'}`));
}

// ----------------------------------------------------------------------------
// BENCHMARK MODE FOR PERFORMANCE TESTING
// ----------------------------------------------------------------------------

async function runBenchmark() {
    console.log(chalk.red('\n🏁 BENCHMARK MODE'));
    console.log(chalk.red('=' .repeat(40)));
    console.log(chalk.white('Running multiple iterations to analyze performance characteristics...\n'));
    
    const iterations = 5;
    const results = [];
    
    for (let i = 1; i <= iterations; i++) {
        console.log(chalk.cyan(`🔄 Running iteration ${i}/${iterations}...`));
        
        const monitor = new PerformanceMonitor();
        monitor.start();
        
        try {
            const result = await runGentzenReasoning(
                join(__dirname, 'scenarios', 'enterprise-kitchen-sink.yaml'),
                {
                    verbose: false,
                    customResolvers: enterpriseResolvers,
                    validate: false  // Skip validation in benchmark for speed
                }
            );
            
            monitor.end(result);
            results.push({
                iteration: i,
                duration: monitor.metrics.duration,
                targets: result.targets.length,
                provenTargets: result.targets.filter(t => t.proven).length,
                memoryPeak: monitor.metrics.memoryUsage.peak?.heapUsed || 0
            });
            
        } catch (error) {
            console.error(chalk.red(`❌ Iteration ${i} failed: ${error.message}`));
            results.push({
                iteration: i,
                duration: null,
                error: error.message
            });
        }
    }
    
    // Analyze benchmark results
    console.log(chalk.yellow('\n📊 BENCHMARK RESULTS'));
    console.log(chalk.yellow('-' .repeat(40)));
    
    const successfulRuns = results.filter(r => r.duration !== null);
    if (successfulRuns.length > 0) {
        const avgDuration = successfulRuns.reduce((sum, r) => sum + r.duration, 0) / successfulRuns.length;
        const minDuration = Math.min(...successfulRuns.map(r => r.duration));
        const maxDuration = Math.max(...successfulRuns.map(r => r.duration));
        const avgMemory = successfulRuns.reduce((sum, r) => sum + r.memoryPeak, 0) / successfulRuns.length / 1024 / 1024;
        
        console.log(chalk.white(`📈 Execution Time (avg): ${avgDuration.toFixed(2)}ms`));
        console.log(chalk.white(`📈 Execution Time (min): ${minDuration.toFixed(2)}ms`));
        console.log(chalk.white(`📈 Execution Time (max): ${maxDuration.toFixed(2)}ms`));
        console.log(chalk.white(`🧠 Memory Usage (avg): ${avgMemory.toFixed(2)} MB`));
        console.log(chalk.white(`✅ Success Rate: ${(successfulRuns.length / iterations * 100).toFixed(1)}%`));
        
        // Performance consistency analysis
        const stdDev = Math.sqrt(
            successfulRuns.reduce((sum, r) => sum + Math.pow(r.duration - avgDuration, 2), 0) / successfulRuns.length
        );
        const coefficient = (stdDev / avgDuration) * 100;
        
        console.log(chalk.white(`📊 Performance Consistency: ${coefficient.toFixed(1)}% coefficient of variation`));
        
        if (coefficient < 10) {
            console.log(chalk.green('🏆 Performance is highly consistent'));
        } else if (coefficient < 25) {
            console.log(chalk.yellow('⚠️  Performance has moderate variation'));
        } else {
            console.log(chalk.red('🔴 Performance is highly variable'));
        }
    }
    
    // Detailed results table
    console.log(chalk.cyan('\n📋 DETAILED RESULTS'));
    console.log(chalk.cyan('-' .repeat(60)));
    console.log(chalk.white('Iter | Duration(ms) | Targets | Proven | Memory(MB)'));
    console.log(chalk.white('-' .repeat(60)));
    
    results.forEach(result => {
        if (result.duration !== null) {
            const memoryMB = (result.memoryPeak / 1024 / 1024).toFixed(1);
            console.log(chalk.white(`${result.iteration.toString().padStart(4)} | ${result.duration.toString().padStart(11)} | ${result.targets.toString().padStart(7)} | ${result.provenTargets.toString().padStart(6)} | ${memoryMB.padStart(9)}`));
        } else {
            console.log(chalk.red(`${result.iteration.toString().padStart(4)} | ${'ERROR'.padStart(11)} | ${'-'.padStart(7)} | ${'-'.padStart(6)} | ${'-'.padStart(9)}`));
        }
    });
}

// ----------------------------------------------------------------------------
// MAIN EXECUTION AND ERROR HANDLING
// ----------------------------------------------------------------------------

async function main() {
    try {
        displayIntroduction();
        
        if (benchmarkMode) {
            await runBenchmark();
        } else {
            await runKitchenSinkDemo();
        }
        
        console.log(chalk.green('\n🎉 DEMONSTRATION COMPLETED SUCCESSFULLY!'));
        console.log(chalk.blue('=' .repeat(60)));
        
        if (!isQuiet) {
            console.log(chalk.white('\n📚 EDUCATIONAL TAKEAWAYS:'));
            console.log(chalk.white('• This example demonstrates how formal logic can model complex business rules'));
            console.log(chalk.white('• Every enterprise decision can be broken down into logical constructs'));
            console.log(chalk.white('• The Gentzen system provides mathematical proof of business logic correctness'));
            console.log(chalk.white('• Complex scenarios can be validated automatically through reasoning'));
            console.log(chalk.white('• This approach enables auditability and compliance verification'));
            
            console.log(chalk.yellow('\n🔧 NEXT STEPS FOR DEVELOPERS:'));
            console.log(chalk.white('1. Study the scenario file to understand logical construct usage'));
            console.log(chalk.white('2. Examine the resolver patterns for external system integration'));
            console.log(chalk.white('3. Experiment with modifying business rules and observing outcomes'));
            console.log(chalk.white('4. Apply these patterns to your own enterprise logic requirements'));
            console.log(chalk.white('5. Consider how formal verification can improve system reliability'));
        }
        
    } catch (error) {
        logger.error('💥 Demonstration failed with error:', error.message);
        
        if (isVerbose) {
            console.error('\n🔍 Full error stack:', error.stack);
        }
        
        console.log(chalk.red('\n❌ DEMONSTRATION FAILED'));
        console.log(chalk.red('This may indicate an issue with the reasoning system or resolver logic.'));
        console.log(chalk.yellow('\n🔧 Troubleshooting suggestions:'));
        console.log(chalk.white('• Check that all required dependencies are installed'));
        console.log(chalk.white('• Verify the scenario file syntax is correct'));
        console.log(chalk.white('• Ensure resolver functions are not throwing unexpected errors'));
        console.log(chalk.white('• Run with --verbose flag for detailed debugging information'));
        console.log(chalk.white('• Check system resources and memory availability'));
        
        process.exit(1);
    }
}

// ----------------------------------------------------------------------------
// SCRIPT EXECUTION
// ----------------------------------------------------------------------------

// Display usage information if help is requested
if (args.includes('--help') || args.includes('-h')) {
    console.log(chalk.blue('\n🏢 ENTERPRISE KITCHEN SINK DEMONSTRATION'));
    console.log(chalk.blue('=' .repeat(50)));
    console.log(chalk.white('\nUsage: node examples/demo-kitchen-sink.js [options]'));
    console.log(chalk.white('\nOptions:'));
    console.log(chalk.white('  --verbose, -v     Enable verbose output with detailed logging'));
    console.log(chalk.white('  --quiet, -q       Suppress non-essential output'));
    console.log(chalk.white('  --performance, -p Show detailed performance metrics'));
    console.log(chalk.white('  --benchmark, -b   Run multiple iterations for performance analysis'));
    console.log(chalk.white('  --help, -h        Show this help message'));
    console.log(chalk.white('\nExamples:'));
    console.log(chalk.white('  node examples/demo-kitchen-sink.js --verbose'));
    console.log(chalk.white('  node examples/demo-kitchen-sink.js --performance'));
    console.log(chalk.white('  node examples/demo-kitchen-sink.js --benchmark'));
    console.log(chalk.white('  node examples/demo-kitchen-sink.js --quiet'));
    process.exit(0);
}

// Execute the main demonstration
main();