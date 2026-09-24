import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@env": "./source/env.ts",
			"@dock": "./source/dock.ts",
			"@drizz": "./drizzle",
			"@tests": "./testing",
			"@app": "./source/app",
			"@core": "./source/core",
			"@infra": "./source/infra",
		},
	},
	test: {
		include: ["testing/**/*.test.ts"],
	},
});
