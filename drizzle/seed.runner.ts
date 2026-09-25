import type { Executor } from "@drizz/database/helpers/executor.helper";

export interface Seeder {
	readonly name: string;
	run(db: Executor): Promise<void>;
}

export class SeedRunner {
	private readonly seeders: Seeder[] = [];

	constructor(private readonly tx: Executor) {}

	add(seeders: Seeder[]): this {
		this.seeders.push(...seeders);
		return this;
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
