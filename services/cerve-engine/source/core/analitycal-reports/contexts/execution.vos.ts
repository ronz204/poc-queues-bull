import type { AggregationType, GroupByDimension } from "@core/analitycal-reports/contexts/definition.enums";

export interface ReportSnapshotRow {
  readonly groupKey: string;
  readonly value: number;
};

export class ReportSnapshot {
  private constructor(
    public readonly rows: readonly ReportSnapshotRow[],
    public readonly aggregationType: AggregationType,
    public readonly groupBy: GroupByDimension,
    public readonly computedAt: Date,
  ) {};

  public static create(props: {
    rows: readonly ReportSnapshotRow[];
    aggregationType: AggregationType;
    groupBy: GroupByDimension;
    computedAt: Date;
  }): ReportSnapshot {
    return new ReportSnapshot(props.rows, props.aggregationType, props.groupBy, props.computedAt);
  };
};
