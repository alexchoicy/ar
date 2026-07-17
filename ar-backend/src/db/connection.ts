import mongoose from "mongoose";

import { Student } from "./schema/student.js";
import { Suggestion } from "./schema/suggestion.js";

export async function connectDb() {
	const connectionString = process.env.MONGO_CONNECTION_STRING;
	const databaseName = process.env.MONGO_DATABASE_NAME;

	if (!connectionString) {
		throw new Error("MONGO_CONNECTION_STRING is required");
	}

	if (!databaseName) {
		throw new Error("MONGO_DATABASE_NAME is required");
	}

	await mongoose.connect(connectionString, { dbName: databaseName });
	await Student.syncIndexes();
	await Suggestion.syncIndexes();
}
