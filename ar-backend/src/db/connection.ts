import mongoose from "mongoose";

import { Student } from "./schema/student.js";
import { Suggestion } from "./schema/suggestion.js";

export async function connectDb() {
	const connectionString = process.env.MONGO_CONNECTION_STRING;
	const databaseName = process.env.MONGO_DATABASE_NAME;
	const masterKey = process.env.USER_DATA_ENCRYPTION_KEY
		? Buffer.from(process.env.USER_DATA_ENCRYPTION_KEY, "base64")
		: null;

	if (!connectionString) {
		throw new Error("MONGO_CONNECTION_STRING is required");
	}

	if (!databaseName) {
		throw new Error("MONGO_DATABASE_NAME is required");
	}

	if (masterKey?.length !== 32) {
		throw new Error("USER_DATA_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
	}

	await mongoose.connect(connectionString, { dbName: databaseName });
	await Student.syncIndexes();
	await Suggestion.syncIndexes();
}
