export type ParsedArgon2Hash = {
	memory: number;
	passes: number;
	parallelism: number;
	nonce: Buffer;
	expected: Buffer;
};

export type Argon2PhcParts = [
	empty: string,
	algorithm: string,
	version: string,
	parameters: string,
	salt: string,
	hash: string,
];

export type Argon2Parameters = {
	memory: number;
	passes: number;
	parallelism: number;
	tagLength: number;
};

export type Argon2Limits = {
	minMemory: number;
	maxMemory: number;
	minPasses: number;
	maxPasses: number;
	minParallelism: number;
	maxParallelism: number;
};
