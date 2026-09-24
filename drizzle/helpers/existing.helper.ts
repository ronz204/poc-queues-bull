import * as pg from "drizzle-orm/pg-core";

export const sales = pg.pgSchema("sales").existing();
export const reports = pg.pgSchema("reports").existing();

export const runner = pg.pgRole("runner").existing();
export const sampler = pg.pgRole("sampler").existing();
