export class InvalidCronExpressionError extends Error {
	constructor(
		readonly value: string,
		cause?: unknown,
	) {
		super(`"${value}" is not a syntactically valid cron expression`, { cause });
		this.name = "InvalidCronExpressionError";
	}
}

export class InvalidReportWindowError extends Error {
	constructor(
		readonly start: Date,
		readonly end: Date,
	) {
		super(`report window start (${start.toISOString()}) must be before end (${end.toISOString()})`);
		this.name = "InvalidReportWindowError";
	}
}

export class ArchivedDefinitionError extends Error {
	constructor(readonly definitionId: string) {
		super(
			`report definition "${definitionId}" is archived and can no longer be edited or reactivated`,
		);
		this.name = "ArchivedDefinitionError";
	}
}

// Never thrown by the aggregate itself: uniqueness among active names can only be checked
// against other aggregates, so the application layer/repository raises this, not this slice.
export class DuplicateDefinitionNameError extends Error {
	constructor(readonly definitionName: string) {
		super(`an active report definition named "${definitionName}" already exists`);
		this.name = "DuplicateDefinitionNameError";
	}
}
