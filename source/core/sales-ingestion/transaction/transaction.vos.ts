import { assertUuid, UniqueUUID } from "@core/shared-kernel";

export class TransactionId extends UniqueUUID {
	public static from(value: string): TransactionId {
		assertUuid(value, "TransactionId");
		return new TransactionId(value);
	}
}

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
