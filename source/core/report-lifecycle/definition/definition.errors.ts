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

export class ArchivedReportDefinitionError extends Error {
	constructor(readonly reportDefinitionId: string) {
		super(
			`report definition "${reportDefinitionId}" is archived and can no longer be edited or reactivated`,
		);
		this.name = "ArchivedReportDefinitionError";
	}
}

// Never thrown by the aggregate itself: uniqueness among active names can only be checked
// against other aggregates, so the application layer/repository raises this, not this slice.
export class DuplicateReportDefinitionNameError extends Error {
	constructor(readonly reportDefinitionName: string) {
		super(`an active report definition named "${reportDefinitionName}" already exists`);
		this.name = "DuplicateReportDefinitionNameError";
	}
}
