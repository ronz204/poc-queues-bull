import { assertUuid, UniqueUUID } from "@core/common-domain";

export class SaleTransactionId extends UniqueUUID {
	public static from(value: string): SaleTransactionId {
		assertUuid(value, "SaleTransactionId");
		return new SaleTransactionId(value);
	}
}

// Referenced here only as a foreign key this slice reads, not a concept it owns —
// see sales-ingestion.spec.md's Non-goals.
export class ProductId extends UniqueUUID {
	public static from(value: string): ProductId {
		assertUuid(value, "ProductId");
		return new ProductId(value);
	}
}

export class RegionId extends UniqueUUID {
	public static from(value: string): RegionId {
		assertUuid(value, "RegionId");
		return new RegionId(value);
	}
}
