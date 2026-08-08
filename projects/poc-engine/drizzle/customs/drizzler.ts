import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

export interface DrizzlerProps {
  url: string;
}

export class Drizzler {
  readonly db: ReturnType<typeof drizzle>;

  constructor(props: DrizzlerProps) {
    const client = postgres(props.url, { prepare: false });
    this.db = drizzle({ client });
  };
};

export type Database = Drizzler["db"];
