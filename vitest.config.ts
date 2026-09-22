import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
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
