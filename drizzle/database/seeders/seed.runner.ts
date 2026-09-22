import type { Db } from "@drizz/dal/drizzle.client";
import type { UnitOfWork } from "@drizz/dal/drizzle.work";
import type { ProductsSeeder } from "./products.seeder";
import type { RegionsSeeder } from "./regions.seeder";
import type { SalesSeeder } from "./sales.seeder";

interface Seeder {
	readonly name: string;
	run(db: Db): Promise<unknown>;
}

export class SeedRunner {
	private readonly seeders: readonly Seeder[];

	constructor(
		private readonly uow: UnitOfWork,
		products: ProductsSeeder,
		regions: RegionsSeeder,
		sales: SalesSeeder,
	) {
		this.seeders = [products, regions, sales];
	}

	async run() {
		console.log(`🌱 seeding ${this.seeders.length} tables...`);

		await this.uow.run(async (db) => {
			for (const seeder of this.seeders) {
				const startedAt = performance.now();
				process.stdout.write(`   → ${seeder.name}... `);
				await seeder.run(db);
				console.log(`done (${Math.round(performance.now() - startedAt)}ms)`);
			}
		});

		console.log("✅ seeding complete");
	}
}
