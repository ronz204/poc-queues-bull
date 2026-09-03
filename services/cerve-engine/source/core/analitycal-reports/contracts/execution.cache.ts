import type { ReportDefinitionId } from "@core/analitycal-reports/contexts/definition.aggregate";
import type { ReportSnapshot } from "@core/analitycal-reports/contexts/execution.vos";

export interface ReportSnapshotCacheKey {
  reportDefinitionId: ReportDefinitionId;
  reportDefinitionVersion: number;
};

export interface IReportSnapshotCache {
  get(key: ReportSnapshotCacheKey): Promise<ReportSnapshot | null>;
  set(key: ReportSnapshotCacheKey, snapshot: ReportSnapshot): Promise<void>;
};
