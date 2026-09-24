export interface GenerateTransactionProps {
	id: string;
	productId: string;
	regionId: string;
	amount: number;
	occurredAt: Date;
}

export interface TransactionSnapshotProps {
	id: string;
	productId: string;
	regionId: string;
	amount: number;
	occurredAt: Date;
	createdAt: Date;
}
