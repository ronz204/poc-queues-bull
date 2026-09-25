import {
	type DefinitionId,
	Execution,
	type ExecutionId,
	type ExecutionIdempotencyKey,
	type IExecutionStore,
} from "@core/report-lifecycle";
import type { Executor } from "@drizz/helpers/executor.helper";
import { executions } from "@drizz/models/executions.model";
import { and, desc, eq } from "drizzle-orm";

export class ExecutionStore implements IExecutionStore {
	constructor(private readonly db: Executor) {}

	async create(execution: Execution): Promise<void> {
		await this.db.insert(executions).values(execution.toSnapshot());
	}

	async update(execution: Execution): Promise<void> {
		const {
			id,
			definitionId,
			definitionVersion,
			triggerType,
			scheduledFor,
			createdAt,
			...changes
		} = execution.toSnapshot();
		await this.db.update(executions).set(changes).where(eq(executions.id, id));
	}

	async findById(id: ExecutionId): Promise<Execution | null> {
		const [row] = await this.db
			.select()
			.from(executions)
			.where(eq(executions.id, id.value))
			.limit(1);
		return row ? Execution.reconstitute(row) : null;
	}

	async findByIdempotencyKey(key: ExecutionIdempotencyKey): Promise<Execution | null> {
		const [row] = await this.db
			.select()
			.from(executions)
			.where(
				and(
					eq(executions.definitionId, key.definitionId.value),
					eq(executions.definitionVersion, key.definitionVersion),
					eq(executions.triggerType, key.triggerType),
					eq(executions.scheduledFor, key.scheduledFor),
				),
			)
			.limit(1);
		return row ? Execution.reconstitute(row) : null;
	}

	async listByDefinition(definitionId: DefinitionId): Promise<Execution[]> {
		const rows = await this.db
			.select()
			.from(executions)
			.where(eq(executions.definitionId, definitionId.value))
			.orderBy(desc(executions.scheduledFor));
		return rows.map((row) => Execution.reconstitute(row));
	}
}
