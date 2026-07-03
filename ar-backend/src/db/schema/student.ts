import { Schema, model } from "mongoose";
import type { InferSchemaType } from "mongoose";

const studentSchema = new Schema(
	{
		studentId: {
			type: String,
			required: true,
			unique: true,
			trim: true,
			match: /^\d{8}$/,
		},
		email: { type: String, required: true, trim: true, lowercase: true },
		name: { type: String, required: true, trim: true },
		faculty: { type: String, required: true, trim: true },
		major: { type: String, required: true, trim: true },
		yearOfStudy: { type: Number, required: true, min: 1 },
		interests: { type: [String], default: [] },
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

export type StudentDocument = InferSchemaType<typeof studentSchema>;

export const Student = model<StudentDocument>("Student", studentSchema);
