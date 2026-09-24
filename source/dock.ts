import type { IDefinitionStore } from "@core/report-lifecycle";
import { TxToken } from "@drizz/drizzler";
import { ProductsSeeder } from "@drizz/seeders/products.seeder";
import { RegionsSeeder } from "@drizz/seeders/regions.seeder";
import { SalesSeeder } from "@drizz/seeders/sales.seeder";
import { SeedRunner } from "@drizz/seeders/seed.runner";
import { DefinitionStore } from "@infra/stores/definition.store";
import { type Module, token } from "dockdi";

// ==========================================
// ====== Stores
// ==========================================

export const DefinitionStoreToken = token<IDefinitionStore>("DefinitionStore");

export const storesDock: Module = (container) => {
	container.bind(DefinitionStoreToken).toClass(DefinitionStore, [TxToken]);
};

// ==========================================
// ====== Seeding
// ==========================================

export const ProductsSeederToken = token(ProductsSeeder);
export const RegionsSeederToken = token(RegionsSeeder);
export const SalesSeederToken = token(SalesSeeder);
export const SeedRunnerToken = token(SeedRunner);

export const seedingDock: Module = (container) => {
	container.bind(ProductsSeederToken).toClass(ProductsSeeder);
	container.bind(RegionsSeederToken).toClass(RegionsSeeder);
	container.bind(SalesSeederToken).toClass(SalesSeeder);

	container
		.bind(SeedRunnerToken)
		.toClass(SeedRunner, [TxToken, ProductsSeederToken, RegionsSeederToken, SalesSeederToken]);
};
