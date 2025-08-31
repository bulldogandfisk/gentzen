export default {
	files: [
		'tests/**/*.test.js'
	],
	verbose: true,
	timeout: '30s',
	concurrency: 5,
	failFast: false,
	tap: false,
	color: true,
	match: [],
	watchMode: {
		ignoreChanges: [
			'node_modules/**',
			'coverage/**',
			'*.md'
		]
	}
};