import {
	Definition,
	type DefinitionId,
	type DefinitionListFilter,
	DuplicateDefinitionNameError,
	type IDefinitionStore,
} from "@core/report-lifecycle";
import { isUniqueViolation } from "@drizz/helpers/asserts.helper";
import type { Executor } from "@drizz/helpers/executor.helper";
import { definitions } from "@drizz/models/definitions.model";
import { asc, eq } from "drizzle-orm";

const ACTIVE_NAME_CONSTRAINT = "definitions_active_name_idx";

export class DefinitionStore implements IDefinitionStore {
	constructor(private readonly db: Executor) {}

	async create(definition: Definition): Promise<void> {
		try {
			await this.db.insert(definitions).values(definition.toSnapshot());
		} catch (error) {
			throw this.translate(error, definition);
		}
	}

	async update(definition: Definition): Promise<void> {
		const { id, createdAt, ...changes } = definition.toSnapshot();
		try {
			await this.db.update(definitions).set(changes).where(eq(definitions.id, id));
		} catch (error) {
			throw this.translate(error, definition);
		}
	}

	async findById(id: DefinitionId): Promise<Definition | null> {
		const [row] = await this.db
			.select()
			.from(definitions)
			.where(eq(definitions.id, id.value))
			.limit(1);
		return row ? Definition.reconstitute(row) : null;
	}

	async list(filter: DefinitionListFilter = {}): Promise<Definition[]> {
		const rows = await this.db
			.select()
			.from(definitions)
			.where(filter.status ? eq(definitions.status, filter.status) : undefined)
			.orderBy(asc(definitions.createdAt));
		return rows.map((row) => Definition.reconstitute(row));
	}

	private translate(error: unknown, definition: Definition): unknown {
		return isUniqueViolation(error, ACTIVE_NAME_CONSTRAINT)
			? new DuplicateDefinitionNameError(definition.name)
			: error;
	}
}
