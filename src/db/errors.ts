export class DatabaseRecordNotFoundError extends Error {
	constructor(recordName: string) {
		super(`${recordName} not found`);
		this.name = "DatabaseRecordNotFoundError";
	}
}

export class DatabaseRelationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DatabaseRelationError";
	}
}
