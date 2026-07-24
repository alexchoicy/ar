import { Schema, model } from "mongoose";
import type { InferSchemaType } from "mongoose";

import { FACULTIES, INTERESTS } from "../../constants/student.js";

const studentSchema = new Schema(
	{
		studentId: { type: String, default: null },
		studentIdIndex: { type: String },
		email: { type: String, required: true },
		emailIndex: { type: String, required: true },
		name: { type: String, required: true, trim: true },
		faculty: { type: String, required: true, trim: true, enum: FACULTIES },
		major: { type: String, trim: true },
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
		surveySubmittedAt: { type: Date, default: null },
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

studentSchema.index({ studentIdIndex: 1 }, { unique: true, sparse: true });
studentSchema.index({ emailIndex: 1 }, { unique: true });

export type StudentDocument = InferSchemaType<typeof studentSchema>;

export const Student = model<StudentDocument>("Student", studentSchema);
