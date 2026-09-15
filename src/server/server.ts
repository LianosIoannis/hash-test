import "dotenv/config";
import prisma from "../db/prisma.js";
import { createApp } from "./app.js";

const host = "127.0.0.1";
const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
	throw new Error("PORT must be an integer between 1 and 65535");
}

const app = createApp();
const server = app.listen(port, host, () => {
	console.log(`Local admin API listening at http://${host}:${port}`);
	console.log("Authentication is disabled. Do not expose this server publicly.");
});

async function shutdown() {
	server.close(async (error) => {
		await prisma.$disconnect();

		if (error) {
			console.error(error);
			process.exitCode = 1;
		}
	});
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
