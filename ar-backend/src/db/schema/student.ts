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
		name: { type: String, required: true, trim: true },
		faculty: { type: String, required: true, trim: true },
		major: { type: String, required: true, trim: true },
		yearOfStudy: { type: Number, required: true, min: 1 },
		interests: { type: [String], default: [] },
		eStamps: {
			type: [
				{
					stampId: { type: String, required: true, trim: true },
					earned: { type: Boolean, default: false },
				},
			],
			default: [],
		},
		redeemed: {
			minorGift: {
				redeemed: { type: Boolean, default: false },
			},
			majorGift: {
				redeemed: { type: Boolean, default: false },
			},
		},
	},
	{ timestamps: true },
);

export type StudentDocument = InferSchemaType<typeof studentSchema>;

export const Student = model<StudentDocument>("Student", studentSchema);
