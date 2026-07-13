import { Schema, model } from "mongoose";
import type { InferSchemaType } from "mongoose";

import { FACULTIES } from "../../constants/student.js";

const suggestionSchema = new Schema(
	{
		faculty: { type: String, required: true, enum: FACULTIES },
		studyYears: {
			type: [{ type: Number, min: 1 }],
			required: true,
		},
		eventIds: {
			type: [{ type: Schema.Types.ObjectId, ref: "Event" }],
			default: [],
		},
	},
	{ timestamps: true },
);

suggestionSchema.index({ faculty: 1, studyYears: 1 }, { unique: true });

export type SuggestionDocument = InferSchemaType<typeof suggestionSchema>;

export const Suggestion = model<SuggestionDocument>("Suggestion", suggestionSchema);
