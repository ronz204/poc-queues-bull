import { ProductsSeeder } from "@drizz/database/seeders/products.seeder";
import { RegionsSeeder } from "@drizz/database/seeders/regions.seeder";
import { SalesSeeder } from "@drizz/database/seeders/sales.seeder";
import { SeedRunner } from "@drizz/database/seeders/seed.runner";
import { env } from "@env";
import { Container, token } from "dockdi";
import { DrizzleClient } from "./drizzle.client";
import { DrizzleUnitOfWork, type UnitOfWork } from "./drizzle.work";

export const SamplerClientToken = token<DrizzleClient>("SamplerClient");
export const UnitOfWorkToken = token<UnitOfWork>("UnitOfWork");
export const ProductsSeederToken = token(ProductsSeeder);
export const RegionsSeederToken = token(RegionsSeeder);
export const SalesSeederToken = token(SalesSeeder);
export const SeedRunnerToken = token(SeedRunner);

export class SeedContainerFactory {
	static create(): Container {
		const container = new Container();

		container
			.bind(SamplerClientToken)
			.toFactory(() => new DrizzleClient(env.POSTGRES_SAMPLER_URL))
			.inSingleton();

		container
			.bind(UnitOfWorkToken)
			.toClass(DrizzleUnitOfWork, [SamplerClientToken])
			.inSingleton();

		container.bind(ProductsSeederToken).toClass(ProductsSeeder);
		container.bind(RegionsSeederToken).toClass(RegionsSeeder);
		container.bind(SalesSeederToken).toClass(SalesSeeder);

		container
			.bind(SeedRunnerToken)
			.toClass(SeedRunner, [
				UnitOfWorkToken,
				ProductsSeederToken,
				RegionsSeederToken,
				SalesSeederToken,
			]);

		return container;
	}
}
