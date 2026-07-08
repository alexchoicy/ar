import { Schema, model } from "mongoose";
import type { InferSchemaType } from "mongoose";

import { FACULTIES, INTERESTS } from "../../constants/student.js";

const studentSchema = new Schema(
	{
		studentId: {
			type: String,
			required: true,
			trim: true,
			match: /^\d{8}$/,
		},
		email: { type: String, required: true, trim: true, lowercase: true },
		name: { type: String, required: true, trim: true },
		faculty: { type: String, required: true, trim: true, enum: FACULTIES },
		major: { type: String, required: true, trim: true },
		yearOfStudy: { type: Number, required: true, min: 1 },
		interests: { type: [{ type: String, enum: INTERESTS }], default: [] },
		eStamps: {
			type: [
				{
					id: { type: Schema.Types.ObjectId, ref: "Booth", required: true },
					dateTime: { type: Date, required: true },
				},
			],
			default: [],
		},
		savedEvents: { type: [{ type: Schema.Types.ObjectId, ref: "Event" }], default: [] },
		savedBooths: { type: [{ type: Schema.Types.ObjectId, ref: "Booth" }], default: [] },
		isCompletedSurvey: { type: Boolean, default: false },
		redeemed: {
			minorGift: {
				redeemedDateTime: { type: Date },
			},
			majorGift: {
				redeemedDateTime: { type: Date },
			},
		},
	},
	{ timestamps: true },
);

studentSchema.index(
	{ studentId: 1 },
	{ unique: true, partialFilterExpression: { studentId: { $ne: "00000000" } } },
);

export type StudentDocument = InferSchemaType<typeof studentSchema>;

export const Student = model<StudentDocument>("Student", studentSchema);
