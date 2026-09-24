import { SeedRunnerToken, seedingDock } from "@dock";
import { Drizzler } from "@drizz/drizzler";
import { env } from "@env";
import { Container } from "dockdi";

const drizzler = new Drizzler(new Container().load(seedingDock), env.POSTGRES_SAMPLER_URL);
console.log("🔌 connecting to Postgres as sampler...");

try {
	const startedAt = performance.now();
	await drizzler.run(SeedRunnerToken, (runner) => runner.run());
	console.log(`🏁 done in ${Math.round(performance.now() - startedAt)}ms`);
} catch (error) {
	console.error("❌ seeding failed:", error);
	process.exitCode = 1;
} finally {
	await drizzler.close();
}
