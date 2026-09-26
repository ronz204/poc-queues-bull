import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@env": "./source/env.ts",
			"@dock": "./source/dock.ts",
			"@tests": "./testing",
			"@app": "./source/app",
			"@core": "./source/core",
			"@infra": "./source/infra",
			"@db": "./drizzle/database",
		},
	},
	test: {
		include: ["testing/**/*.test.ts"],
	},
});
