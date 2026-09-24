import { InvalidSaleAmountError } from "./transaction.errors";
import type { GenerateTransactionProps, TransactionSnapshotProps } from "./transaction.types";
import { ProductId, RegionId, TransactionId } from "./transaction.vos";

export class Transaction {
	readonly id: TransactionId;
	readonly productId: ProductId;
	readonly regionId: RegionId;
	readonly amount: number;
	readonly occurredAt: Date;
	readonly createdAt: Date;

	private constructor(props: TransactionSnapshotProps) {
		this.id = TransactionId.from(props.id);
		this.productId = ProductId.from(props.productId);
		this.regionId = RegionId.from(props.regionId);
		this.amount = props.amount;
		this.occurredAt = props.occurredAt;
		this.createdAt = props.createdAt;
	}

	public static generate(props: GenerateTransactionProps): Transaction {
		if (props.amount <= 0) {
			throw new InvalidSaleAmountError(props.amount);
		}

		return Transaction.reconstitute({ ...props, createdAt: new Date() });
	}

	public static reconstitute(snapshot: TransactionSnapshotProps): Transaction {
		return new Transaction(snapshot);
	}
}
