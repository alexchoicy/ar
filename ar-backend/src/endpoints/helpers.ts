import createHttpError from "http-errors";
import { Types } from "mongoose";

import { clearCache } from "../middleware/cache.js";

export async function deleteRecordById(model: any, id: string, label: string) {
	if (!Types.ObjectId.isValid(id)) {
		throw createHttpError(404, `${label} not found`);
	}

	const record = await model.findByIdAndDelete(id).lean();

	if (!record) {
		throw createHttpError(404, `${label} not found`);
	}

	clearCache();
}
