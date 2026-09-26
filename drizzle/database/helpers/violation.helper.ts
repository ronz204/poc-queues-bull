import { DuplicateDefinitionNameError } from "@core/report-lifecycle";
import { DrizzleQueryError } from "drizzle-orm";

const SQLSTATE_KINDS = {
	"23505": "unique",
	"23502": "not_null",
	"23503": "foreign_key",
	"23514": "check",
} as const;

export type ViolationKind = (typeof SQLSTATE_KINDS)[keyof typeof SQLSTATE_KINDS];

interface PostgresErrorShape {
	code?: string;
	constraint_name?: string;
	table_name?: string;
	column_name?: string;
	detail?: string;
}

export class ConstraintViolation extends Error {
	constructor(
		readonly kind: ViolationKind,
		readonly constraint: string | null,
		readonly table: string | null,
		readonly column: string | null,
		readonly values: Readonly<Record<string, string>>,
		cause: unknown,
	) {
		super(`${kind} violation on ${constraint ?? table ?? "unknown"}`, { cause });
		this.name = "ConstraintViolation";
	}
}

const VIOLATION_MAP: Readonly<Record<string, (violation: ConstraintViolation) => Error>> = {
	definitions_active_name_idx: (violation) =>
		new DuplicateDefinitionNameError(violation.values.name ?? "unknown"),
};

const DETAIL_KEY = /^Key \((.+?)\)=\((.*)\)/;

const parseDetail = (detail: string | undefined): Record<string, string> => {
	const [, rawColumns, rawValues] = detail?.match(DETAIL_KEY) ?? [];
	if (rawColumns === undefined || rawValues === undefined) return {};

	const columns = rawColumns.split(", ");
	const values = rawValues.split(", ");
	if (columns.length !== values.length) return {};

	return Object.fromEntries(columns.map((column, index) => [column, values[index] ?? ""]));
};

const isKnownCode = (code: string | undefined): code is keyof typeof SQLSTATE_KINDS =>
	code !== undefined && code in SQLSTATE_KINDS;

export const toViolation = (error: unknown): ConstraintViolation | null => {
	if (!(error instanceof DrizzleQueryError)) return null;

	const cause = error.cause as PostgresErrorShape | undefined;
	if (!isKnownCode(cause?.code)) return null;

	return new ConstraintViolation(
		SQLSTATE_KINDS[cause.code],
		cause.constraint_name ?? null,
		cause.table_name ?? null,
		cause.column_name ?? null,
		parseDetail(cause.detail),
		error,
	);
};

export const translateViolation = (error: unknown): unknown => {
	const violation = toViolation(error);
	if (!violation) return error;

	const map = violation.constraint ? VIOLATION_MAP[violation.constraint] : undefined;
	return map ? map(violation) : violation;
};

export const isViolation = (
	error: unknown,
	kind: ViolationKind,
	constraint?: string,
): error is ConstraintViolation =>
	error instanceof ConstraintViolation &&
	error.kind === kind &&
	(constraint === undefined || error.constraint === constraint);
