import { ProductsSeeder } from "@drizz/database/seeders/products.seeder";
import { RegionsSeeder } from "@drizz/database/seeders/regions.seeder";
import { SalesSeeder } from "@drizz/database/seeders/sales.seeder";
import { Drizzler, TxToken } from "@drizz/drizzle.wrap";
import { SeedRunner } from "@drizz/seed.runner";
import { env } from "@env";
import { Container } from "dockdi";

const drizzler = new Drizzler(new Container(), env.POSTGRES_SAMPLER_URL);

try {
	const startedAt = performance.now();
	await drizzler.run(TxToken, (tx) =>
		new SeedRunner(tx).add([new ProductsSeeder(), new RegionsSeeder(), new SalesSeeder()]).run(),
	);
	console.log(`🏁 done in ${Math.round(performance.now() - startedAt)}ms`);
} catch (error) {
	console.error("❌ seeding failed:", error);
	process.exitCode = 1;
} finally {
	await drizzler.close();
}
