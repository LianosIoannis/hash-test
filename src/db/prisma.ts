import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client.js";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL environment variable is not set");
}

const adapter = new PrismaBetterSqlite3({
	url: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

export default prisma;
