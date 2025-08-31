#!/usr/bin/env node

// ============================================================================
// EXAMPLES TEST RUNNER
// ============================================================================
//
// This script automatically discovers and runs all example demonstrations
// to validate they execute successfully. It serves as an integration test
// for the examples directory and helps ensure all demos remain functional.
//
// USAGE:
//   npm run test:examples
//   node examples/run-all-examples.js [options]
//
// OPTIONS:
//   --verbose, -v     Show detailed output from each example
//   --timeout=N       Set timeout in seconds (default: 30)
//   --parallel        Run examples in parallel (faster but less readable)
//   --filter=pattern  Only run examples matching pattern
//   --help, -h        Show help message
//
// ============================================================================

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import chalk from 'chalk';

// Get current directory for path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// CONFIGURATION AND COMMAND LINE PARSING
// ============================================================================

const args = process.argv.slice(2);
const options = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    help: args.includes('--help') || args.includes('-h'),
    parallel: args.includes('--parallel'),
    timeout: parseInt(args.find(arg => arg.startsWith('--timeout='))?.split('=')[1]) || 30,
    filter: args.find(arg => arg.startsWith('--filter='))?.split('=')[1] || null
};

// ============================================================================
// HELP AND USAGE INFORMATION
// ============================================================================

function showHelp() {
    console.log(chalk.blue('\n📋 EXAMPLES TEST RUNNER'));
    console.log(chalk.blue('=' .repeat(50)));
    console.log(chalk.white('\nAutomatically runs all example demonstrations to validate functionality.\n'));
    
    console.log(chalk.white('Usage:'));
    console.log(chalk.white('  npm run test:examples'));
    console.log(chalk.white('  node examples/run-all-examples.js [options]\n'));
    
    console.log(chalk.white('Options:'));
    console.log(chalk.white('  --verbose, -v         Show detailed output from each example'));
    console.log(chalk.white('  --timeout=N          Set timeout in seconds (default: 30)'));
    console.log(chalk.white('  --parallel           Run examples in parallel'));
    console.log(chalk.white('  --filter=pattern     Only run examples matching pattern'));
    console.log(chalk.white('  --help, -h           Show this help message\n'));
    
    console.log(chalk.white('Examples:'));
    console.log(chalk.white('  npm run test:examples -- --verbose'));
    console.log(chalk.white('  npm run test:examples -- --timeout=60'));
    console.log(chalk.white('  npm run test:examples -- --filter=kitchen-sink'));
    console.log(chalk.white('  npm run test:examples -- --parallel'));
    
    process.exit(0);
}

if (options.help) {
    showHelp();
}

// ============================================================================
// EXAMPLE DISCOVERY AND FILTERING
// ============================================================================

async function discoverExamples() {
    try {
        const files = await readdir(__dirname);
        const demoFiles = files.filter(file => {
            // Must be a demo-*.js file
            if (!file.startsWith('demo-') || !file.endsWith('.js')) {
                return false;
            }
            
            // Apply filter if specified
            if (options.filter) {
                return file.includes(options.filter);
            }
            
            return true;
        });
        
        return demoFiles.sort(); // Ensure consistent ordering
    } catch (error) {
        console.error(chalk.red('❌ Failed to discover examples:'), error.message);
        process.exit(1);
    }
}

// ============================================================================
// EXAMPLE EXECUTION ENGINE
// ============================================================================

class ExampleRunner {
    constructor(exampleFile) {
        this.exampleFile = exampleFile;
        this.name = exampleFile.replace('.js', '').replace('demo-', '');
        this.startTime = null;
        this.endTime = null;
        this.output = '';
        this.error = '';
        this.exitCode = null;
        this.timedOut = false;
    }
    
    async run() {
        return new Promise((resolve) => {
            this.startTime = Date.now();
            
            const examplePath = join(__dirname, this.exampleFile);
            const child = spawn('node', [examplePath], {
                cwd: __dirname,
                stdio: options.verbose ? 'inherit' : 'pipe'
            });
            
            // Set up timeout
            const timeout = setTimeout(() => {
                this.timedOut = true;
                child.kill('SIGTERM');
            }, options.timeout * 1000);
            
            // Capture output if not in verbose mode
            if (!options.verbose) {
                child.stdout?.on('data', (data) => {
                    this.output += data.toString();
                });
                
                child.stderr?.on('data', (data) => {
                    this.error += data.toString();
                });
            }
            
            child.on('close', (code) => {
                clearTimeout(timeout);
                this.endTime = Date.now();
                this.exitCode = code;
                resolve(this);
            });
            
            child.on('error', (error) => {
                clearTimeout(timeout);
                this.endTime = Date.now();
                this.error = error.message;
                this.exitCode = -1;
                resolve(this);
            });
        });
    }
    
    get duration() {
        return this.endTime - this.startTime;
    }
    
    get isSuccess() {
        return this.exitCode === 0 && !this.timedOut;
    }
    
    get status() {
        if (this.timedOut) return 'TIMEOUT';
        if (this.exitCode === 0) return 'SUCCESS';
        return 'FAILED';
    }
    
    get statusColor() {
        switch (this.status) {
            case 'SUCCESS': return chalk.green;
            case 'TIMEOUT': return chalk.yellow;
            case 'FAILED': return chalk.red;
            default: return chalk.white;
        }
    }
}

// ============================================================================
// PARALLEL EXECUTION MANAGER
// ============================================================================

async function runExamplesParallel(examples) {
    console.log(chalk.cyan(`🚀 Running ${examples.length} examples in parallel...\n`));
    
    const runners = examples.map(example => new ExampleRunner(example));
    const startTime = Date.now();
    
    // Run all examples concurrently
    const results = await Promise.all(runners.map(runner => runner.run()));
    
    const totalTime = Date.now() - startTime;
    return { results, totalTime };
}

// ============================================================================
// SEQUENTIAL EXECUTION MANAGER
// ============================================================================

async function runExamplesSequential(examples) {
    console.log(chalk.cyan(`🚀 Running ${examples.length} examples sequentially...\n`));
    
    const results = [];
    const startTime = Date.now();
    
    for (let i = 0; i < examples.length; i++) {
        const example = examples[i];
        const runner = new ExampleRunner(example);
        
        console.log(chalk.white(`[${i + 1}/${examples.length}] Running ${chalk.bold(runner.name)}...`));
        
        const result = await runner.run();
        results.push(result);
        
        // Show immediate result
        const statusIcon = result.isSuccess ? '✅' : (result.timedOut ? '⏰' : '❌');
        const duration = `${result.duration}ms`;
        console.log(`  ${statusIcon} ${result.statusColor(result.status)} (${duration})\n`);
        
        // Show output/error if not verbose and there was a failure
        if (!options.verbose && !result.isSuccess) {
            if (result.output.trim()) {
                console.log(chalk.gray('  Output:'));
                console.log(chalk.gray(result.output.trim().split('\n').map(line => `    ${line}`).join('\n')));
            }
            if (result.error.trim()) {
                console.log(chalk.gray('  Error:'));
                console.log(chalk.gray(result.error.trim().split('\n').map(line => `    ${line}`).join('\n')));
            }
            console.log('');
        }
    }
    
    const totalTime = Date.now() - startTime;
    return { results, totalTime };
}

// ============================================================================
// RESULTS ANALYSIS AND REPORTING
// ============================================================================

function displaySummary(results, totalTime) {
    const successful = results.filter(r => r.isSuccess);
    const failed = results.filter(r => r.exitCode !== 0 && !r.timedOut);
    const timedOut = results.filter(r => r.timedOut);
    
    console.log(chalk.blue('\n📊 EXECUTION SUMMARY'));
    console.log(chalk.blue('=' .repeat(50)));
    
    // Overall statistics
    console.log(chalk.white(`Total Examples: ${results.length}`));
    console.log(chalk.green(`✅ Successful: ${successful.length}`));
    console.log(chalk.red(`❌ Failed: ${failed.length}`));
    console.log(chalk.yellow(`⏰ Timed Out: ${timedOut.length}`));
    console.log(chalk.white(`⏱️  Total Time: ${totalTime}ms`));
    
    const successRate = (successful.length / results.length * 100).toFixed(1);
    console.log(chalk.white(`📈 Success Rate: ${successRate}%`));
    
    // Performance metrics
    if (successful.length > 0) {
        const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
        const minDuration = Math.min(...successful.map(r => r.duration));
        const maxDuration = Math.max(...successful.map(r => r.duration));
        
        console.log(chalk.cyan('\n⚡ PERFORMANCE METRICS'));
        console.log(chalk.cyan('-' .repeat(30)));
        console.log(chalk.white(`Average Duration: ${avgDuration.toFixed(0)}ms`));
        console.log(chalk.white(`Fastest Example: ${minDuration}ms`));
        console.log(chalk.white(`Slowest Example: ${maxDuration}ms`));
    }
    
    // Detailed results table
    console.log(chalk.cyan('\n📋 DETAILED RESULTS'));
    console.log(chalk.cyan('-' .repeat(60)));
    console.log(chalk.white('Example'.padEnd(20) + 'Status'.padEnd(10) + 'Duration'.padEnd(12) + 'Exit Code'));
    console.log(chalk.gray('-' .repeat(60)));
    
    results.forEach(result => {
        const name = result.name.padEnd(20);
        const status = result.status.padEnd(10);
        const duration = `${result.duration}ms`.padEnd(12);
        const exitCode = result.timedOut ? 'TIMEOUT' : result.exitCode?.toString() || 'ERROR';
        
        console.log(`${name}${result.statusColor(status)}${duration}${exitCode}`);
    });
    
    // Failed examples details
    if (failed.length > 0 || timedOut.length > 0) {
        console.log(chalk.red('\n❌ FAILED EXAMPLES'));
        console.log(chalk.red('-' .repeat(30)));
        
        [...failed, ...timedOut].forEach(result => {
            console.log(chalk.red(`\n${result.name}:`));
            console.log(chalk.white(`  Exit Code: ${result.exitCode}`));
            console.log(chalk.white(`  Duration: ${result.duration}ms`));
            
            if (result.timedOut) {
                console.log(chalk.yellow(`  Reason: Timed out after ${options.timeout} seconds`));
            }
            
            if (result.error.trim() && !options.verbose) {
                console.log(chalk.white('  Error Output:'));
                console.log(chalk.gray(result.error.trim().split('\n').map(line => `    ${line}`).join('\n')));
            }
        });
    }
}

// ============================================================================
// MAIN EXECUTION FLOW
// ============================================================================

async function main() {
    console.log(chalk.bold.blue('\n🧪 EXAMPLES TEST RUNNER'));
    console.log(chalk.blue('=' .repeat(50)));
    
    // Display configuration
    console.log(chalk.white('Configuration:'));
    console.log(chalk.white(`  Timeout: ${options.timeout} seconds`));
    console.log(chalk.white(`  Verbose: ${options.verbose ? 'enabled' : 'disabled'}`));
    console.log(chalk.white(`  Parallel: ${options.parallel ? 'enabled' : 'disabled'}`));
    if (options.filter) {
        console.log(chalk.white(`  Filter: ${options.filter}`));
    }
    console.log('');
    
    // Discover examples
    const examples = await discoverExamples();
    
    if (examples.length === 0) {
        console.log(chalk.yellow('⚠️  No examples found to run.'));
        if (options.filter) {
            console.log(chalk.white(`Filter "${options.filter}" did not match any examples.`));
        }
        process.exit(0);
    }
    
    console.log(chalk.white(`Found ${examples.length} examples to run:`));
    examples.forEach((example, index) => {
        const name = example.replace('.js', '').replace('demo-', '');
        console.log(chalk.white(`  ${index + 1}. ${name}`));
    });
    console.log('');
    
    // Execute examples
    let results, totalTime;
    
    if (options.parallel) {
        ({ results, totalTime } = await runExamplesParallel(examples));
    } else {
        ({ results, totalTime } = await runExamplesSequential(examples));
    }
    
    // Display results
    displaySummary(results, totalTime);
    
    // Exit with appropriate code
    const hasFailures = results.some(r => !r.isSuccess);
    
    if (hasFailures) {
        console.log(chalk.red('\n💥 Some examples failed. See details above.'));
        process.exit(1);
    } else {
        console.log(chalk.green('\n🎉 All examples executed successfully!'));
        process.exit(0);
    }
}

// ============================================================================
// ERROR HANDLING AND SCRIPT EXECUTION
// ============================================================================

// Handle unhandled errors
process.on('unhandledRejection', (error) => {
    console.error(chalk.red('\n💥 Unhandled error:'), error);
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log(chalk.yellow('\n⚠️  Test run interrupted by user'));
    process.exit(130);
});

// Execute main function
main().catch((error) => {
    console.error(chalk.red('\n💥 Test runner failed:'), error.message);
    if (options.verbose) {
        console.error(error.stack);
    }
    process.exit(1);
});