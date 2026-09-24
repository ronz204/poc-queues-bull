import type { Executor } from "@drizz/helpers/executor.helper";
import type { ProductsSeeder } from "./products.seeder";
import type { RegionsSeeder } from "./regions.seeder";
import type { SalesSeeder } from "./sales.seeder";

interface Seeder {
	readonly name: string;
	run(db: Executor): Promise<unknown>;
}

// Never opens its own transaction: the Drizzler run that resolves it owns the boundary.
export class SeedRunner {
	private readonly seeders: readonly Seeder[];

	constructor(
		private readonly tx: Executor,
		products: ProductsSeeder,
		regions: RegionsSeeder,
		sales: SalesSeeder,
	) {
		this.seeders = [products, regions, sales];
	}

	async run() {
		console.log(`🌱 seeding ${this.seeders.length} tables...`);

		for (const seeder of this.seeders) {
			const startedAt = performance.now();
			process.stdout.write(`   → ${seeder.name}... `);
			await seeder.run(this.tx);
			console.log(`done (${Math.round(performance.now() - startedAt)}ms)`);
		}

		console.log("✅ seeding complete");
	}
}
