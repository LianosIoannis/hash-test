import { argon2, randomBytes, timingSafeEqual } from "node:crypto";
import type { Argon2Limits, Argon2Parameters, Argon2PhcParts, ParsedArgon2Hash } from "./models.js";

const ARGON2_OPTIONS: Argon2Parameters = {
	parallelism: 1,
	tagLength: 32,
	memory: 19456,
	passes: 2,
};

const ARGON2_LIMITS: Argon2Limits = {
	minMemory: 8192,
	maxMemory: 131072,
	minPasses: 1,
	maxPasses: 5,
	minParallelism: 1,
	maxParallelism: 4,
};

function encodePhcBase64(buffer: Buffer): string {
	return buffer.toString("base64").replace(/=+$/, "");
}

function decodePhcBase64(value: string): Buffer | null {
	if (!/^[A-Za-z0-9+/]+$/.test(value)) {
		return null;
	}

	const buffer = Buffer.from(value, "base64");

	if (encodePhcBase64(buffer) !== value) {
		return null;
	}

	return buffer;
}

function parseArgon2Hash(encodedHash: string): ParsedArgon2Hash | null {
	if (typeof encodedHash !== "string") {
		return null;
	}

	const parts = encodedHash.split("$");

	if (parts.length !== 6) {
		return null;
	}

	const [empty, algorithm, version, parameterString, saltBase64, hashBase64] = parts as Argon2PhcParts;

	if (empty !== "" || algorithm !== "argon2id" || version !== "v=19") {
		return null;
	}

	const match = /^m=(\d+),t=(\d+),p=(\d+)$/.exec(parameterString);

	if (!match) {
		return null;
	}

	const memory = Number(match[1]);
	const passes = Number(match[2]);
	const parallelism = Number(match[3]);

	if (!Number.isSafeInteger(memory) || !Number.isSafeInteger(passes) || !Number.isSafeInteger(parallelism)) {
		return null;
	}

	const nonce = decodePhcBase64(saltBase64);
	const expected = decodePhcBase64(hashBase64);

	if (!nonce || !expected) {
		return null;
	}

	return {
		memory,
		passes,
		parallelism,
		nonce,
		expected,
	};
}

function hashPassword(password: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const nonce = randomBytes(16);

		const parameters = {
			message: password,
			nonce,
			...ARGON2_OPTIONS,
		};

		argon2("argon2id", parameters, (err, derivedKey) => {
			if (err) {
				return reject(err);
			}

			const hash = encodePhcBase64(derivedKey);
			const salt = encodePhcBase64(nonce);

			const encoded = [
				"",
				"argon2id",
				"v=19",
				`m=${ARGON2_OPTIONS.memory},t=${ARGON2_OPTIONS.passes},p=${ARGON2_OPTIONS.parallelism}`,
				salt,
				hash,
			].join("$");

			resolve(encoded);
		});
	});
}

function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
	return new Promise((resolve, reject) => {
		const parsed = parseArgon2Hash(encodedHash);

		if (!parsed) {
			return resolve(false);
		}

		const { memory, passes, parallelism, nonce, expected } = parsed;

		if (
			memory < ARGON2_LIMITS.minMemory ||
			memory > ARGON2_LIMITS.maxMemory ||
			passes < ARGON2_LIMITS.minPasses ||
			passes > ARGON2_LIMITS.maxPasses ||
			parallelism < ARGON2_LIMITS.minParallelism ||
			parallelism > ARGON2_LIMITS.maxParallelism
		) {
			return resolve(false);
		}

		if (nonce.length !== 16) {
			return resolve(false);
		}

		if (expected.length < 16 || expected.length > 64) {
			return resolve(false);
		}

		argon2(
			"argon2id",
			{
				message: password,
				nonce,
				memory,
				passes,
				parallelism,
				tagLength: expected.length,
			},
			(err, derivedKey) => {
				if (err) {
					return reject(err);
				}

				if (derivedKey.length !== expected.length) {
					return resolve(false);
				}

				resolve(timingSafeEqual(derivedKey, expected));
			},
		);
	});
}

function needsRehash(encodedHash: string): boolean {
	const parsed = parseArgon2Hash(encodedHash);

	if (!parsed) {
		return true;
	}

	return (
		parsed.memory !== ARGON2_OPTIONS.memory ||
		parsed.passes !== ARGON2_OPTIONS.passes ||
		parsed.parallelism !== ARGON2_OPTIONS.parallelism ||
		parsed.expected.length !== ARGON2_OPTIONS.tagLength
	);
}

export { hashPassword, needsRehash, verifyPassword };
