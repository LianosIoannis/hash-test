import { hashPassword, verifyPassword } from "../index.js";

async function benchHash(count = 10) {
	const start = performance.now();

	for (let i = 0; i < count; i++) {
		await hashPassword(`password-${i}`);
	}

	const end = performance.now();
	const total = end - start;

	console.log(`Passwords: ${count}`);
	console.log(`Total: ${(total / 1000).toFixed(2)}s`);
	console.log(`Average: ${(total / count).toFixed(2)}ms`);
	console.log(`Hashes/sec: ${(count / (total / 1000)).toFixed(2)}`);
}

async function benchVerify(count = 100) {
	const password = "my-super-secret-password";
	const hash = await hashPassword(password);

	const start = performance.now();

	let validCount = 0;

	for (let i = 0; i < count; i++) {
		const valid = await verifyPassword(password, hash);

		if (valid) {
			validCount++;
		}
	}

	const end = performance.now();
	const total = end - start;

	console.log(`Verifications: ${count}`);
	console.log(`Valid: ${validCount}`);
	console.log(`Total: ${(total / 1000).toFixed(2)}s`);
	console.log(`Average: ${(total / count).toFixed(2)}ms`);
	console.log(`Verifications/sec: ${(count / (total / 1000)).toFixed(2)}`);
}

await benchHash(100);
await benchVerify(100);
