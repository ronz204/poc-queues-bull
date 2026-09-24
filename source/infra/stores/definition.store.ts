import {
	DuplicateReportDefinitionNameError,
	type IReportDefinitionStore,
	ReportDefinition,
	type ReportDefinitionId,
	type ReportDefinitionListFilter,
} from "@core/report-lifecycle";
import { reportDefinitions } from "@drizz/models/report-definitions.model";
import type { Db } from "@infra/database/database.client";
import { isUniqueViolation } from "@infra/database/database.errors";
import { asc, eq } from "drizzle-orm";

const ACTIVE_NAME_CONSTRAINT = "report_definitions_active_name_idx";

export class ReportDefinitionStore implements IReportDefinitionStore {
	constructor(private readonly db: Db) {}

	async create(definition: ReportDefinition): Promise<void> {
		try {
			await this.db.insert(reportDefinitions).values(definition.toSnapshot());
		} catch (error) {
			throw this.translate(error, definition);
		}
	}

	async update(definition: ReportDefinition): Promise<void> {
		const { id, createdAt, ...changes } = definition.toSnapshot();
		try {
			await this.db.update(reportDefinitions).set(changes).where(eq(reportDefinitions.id, id));
		} catch (error) {
			throw this.translate(error, definition);
		}
	}

	async findById(id: ReportDefinitionId): Promise<ReportDefinition | null> {
		const [row] = await this.db
			.select()
			.from(reportDefinitions)
			.where(eq(reportDefinitions.id, id.value))
			.limit(1);
		return row ? ReportDefinition.reconstitute(row) : null;
	}

	async list(filter: ReportDefinitionListFilter = {}): Promise<ReportDefinition[]> {
		const rows = await this.db
			.select()
			.from(reportDefinitions)
			.where(filter.status ? eq(reportDefinitions.status, filter.status) : undefined)
			.orderBy(asc(reportDefinitions.createdAt));
		return rows.map((row) => ReportDefinition.reconstitute(row));
	}

	private translate(error: unknown, definition: ReportDefinition): unknown {
		return isUniqueViolation(error, ACTIVE_NAME_CONSTRAINT)
			? new DuplicateReportDefinitionNameError(definition.name)
			: error;
	}
}
