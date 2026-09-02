import { InvalidCronExpressionError, InvalidReportWindowError } from "@core/analitycal-reports/contexts/definition.errors";
import parser from "cron-parser";

export class CronExpression {
  private constructor(public readonly value: string) {};

  public static create(raw: string): CronExpression {
    try {
      parser.parse(raw);
    } catch {
      throw new InvalidCronExpressionError(raw);
    }
    return new CronExpression(raw);
  };

  public equals(other: CronExpression): boolean {
    return this.value === other.value;
  };
};

export class ReportWindow {
  private constructor(public readonly start: Date, public readonly end: Date) {};

  public static create(start: Date, end: Date): ReportWindow {
    if (start >= end) throw new InvalidReportWindowError(start, end);
    return new ReportWindow(start, end);
  };
};
