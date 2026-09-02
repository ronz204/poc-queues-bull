export abstract class Identifier {
  protected constructor(readonly value: string) {};

  public equals(other: Identifier): boolean {
    return this.value === other.value;
  };

  public toString(): string {
    return this.value;
  };
};
