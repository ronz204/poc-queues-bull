import {
	SamplerClientToken,
	SeedContainerFactory,
	SeedRunnerToken,
} from "@drizz/dal/drizzle.dock";

const container = SeedContainerFactory.create();
console.log("🔌 connecting to Postgres as sampler...");

try {
	const startedAt = performance.now();
	await container.resolve(SeedRunnerToken).run();
	console.log(`🏁 done in ${Math.round(performance.now() - startedAt)}ms`);
} catch (error) {
	console.error("❌ seeding failed:", error);
	process.exitCode = 1;
} finally {
	await container.resolve(SamplerClientToken).close();
}
