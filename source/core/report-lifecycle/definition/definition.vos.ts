import { assertUuid, UniqueUUID } from "@core/common-domain";
import { InvalidCronExpressionError, InvalidReportWindowError } from "./definition.errors";

const CRON_FIELD_PATTERN = /^(\*|[0-9,\-/]+)$/;

function isSyntacticallyValidCron(expression: string): boolean {
	const fields = expression.trim().split(/\s+/);
	return fields.length === 5 && fields.every((field) => CRON_FIELD_PATTERN.test(field));
}

export class DefinitionId extends UniqueUUID {
	public static from(value: string): DefinitionId {
		assertUuid(value, "DefinitionId");
		return new DefinitionId(value);
	}
}

export class CronExpression {
	private constructor(readonly value: string) {}

	public static from(value: string): CronExpression {
		if (!isSyntacticallyValidCron(value)) {
			throw new InvalidCronExpressionError(value);
		}
		return new CronExpression(value);
	}
}

export class ReportWindow {
	private constructor(
		readonly start: Date,
		readonly end: Date,
	) {}

	public static from(start: Date, end: Date): ReportWindow {
		if (start.getTime() >= end.getTime()) {
			throw new InvalidReportWindowError(start, end);
		}
		return new ReportWindow(start, end);
	}
}
