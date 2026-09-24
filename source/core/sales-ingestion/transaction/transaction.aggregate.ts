import { InvalidSaleAmountError } from "./transaction.errors";
import type {
	GenerateSaleTransactionProps,
	SaleTransactionSnapshotProps,
} from "./transaction.types";
import { ProductId, RegionId, SaleTransactionId } from "./transaction.vos";

export class SaleTransaction {
	readonly id: SaleTransactionId;
	readonly productId: ProductId;
	readonly regionId: RegionId;
	readonly amount: number;
	readonly occurredAt: Date;
	readonly createdAt: Date;

	private constructor(props: SaleTransactionSnapshotProps) {
		this.id = SaleTransactionId.from(props.id);
		this.productId = ProductId.from(props.productId);
		this.regionId = RegionId.from(props.regionId);
		this.amount = props.amount;
		this.occurredAt = props.occurredAt;
		this.createdAt = props.createdAt;
	}

	public static generate(props: GenerateSaleTransactionProps): SaleTransaction {
		if (props.amount <= 0) {
			throw new InvalidSaleAmountError(props.amount);
		}

		return SaleTransaction.reconstitute({ ...props, createdAt: new Date() });
	}

	public static reconstitute(snapshot: SaleTransactionSnapshotProps): SaleTransaction {
		return new SaleTransaction(snapshot);
	}
}
