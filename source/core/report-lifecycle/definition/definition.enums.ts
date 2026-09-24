export type AggregationType = "sum" | "avg" | "count" | "min" | "max";

export const AGGREGATION_TYPES: readonly AggregationType[] = ["sum", "avg", "count", "min", "max"];

export type GroupByDimension = "product" | "region" | "day" | "week" | "month";

export const GROUP_BY_DIMENSIONS: readonly GroupByDimension[] = [
	"product",
	"region",
	"day",
	"week",
	"month",
];

export type ReportDefinitionStatus = "active" | "archived";
