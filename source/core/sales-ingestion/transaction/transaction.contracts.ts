import type { Transaction } from "./transaction.aggregate";
import type { ProductId, RegionId } from "./transaction.vos";

export interface TransactionDimensions {
	productIds: ProductId[];
	regionIds: RegionId[];
}

export interface ITransactionRepository {
	createMany(transactions: Transaction[]): Promise<void>;

	listDimensions(): Promise<TransactionDimensions>;
}
