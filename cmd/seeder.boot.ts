import type { Seeder } from "@db/helpers/seeder.helper";
import { ProductsSeeder } from "@db/seeders/products.seeder";
import { RegionsSeeder } from "@db/seeders/regions.seeder";
import { SalesSeeder } from "@db/seeders/sales.seeder";
import { env } from "@env";
import { Drizzler, TxToken } from "@infra/dal/dal.entrypoint";
import { Container } from "dockdi";

const seeders: Seeder[] = [new ProductsSeeder(), new RegionsSeeder(), new SalesSeeder()];

const drizzler = new Drizzler(new Container(), env.POSTGRES_SAMPLER_URL);

try {
	const startedAt = performance.now();
	console.log(`🌱 seeding ${seeders.length} tables...`);

	await drizzler.run(TxToken, async (tx) => {
		for (const seeder of seeders) {
			const seederStartedAt = performance.now();
			process.stdout.write(`   → ${seeder.name}... `);
			await seeder.run(tx);
			console.log(`done (${Math.round(performance.now() - seederStartedAt)}ms)`);
		}
	});

	console.log(`🏁 seeding complete in ${Math.round(performance.now() - startedAt)}ms`);
} catch (error) {
	console.error("❌ seeding failed:", error);
	process.exitCode = 1;
} finally {
	await drizzler.close();
}
