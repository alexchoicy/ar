import { Schema, model } from "mongoose";
import type { InferSchemaType } from "mongoose";

const boothSchema = new Schema(
	{
		boothCode: { type: String, required: true, unique: true, trim: true },
		name: { type: String, required: true, trim: true },
		overview: { type: String, required: true, trim: true },
		category: { type: String, required: true, trim: true },
		locationId: { type: Schema.Types.ObjectId, ref: "Location", required: true, index: true },
		startTime: { type: String, required: true, trim: true },
		endTime: { type: String, required: true, trim: true },
		imageObject: { type: String, required: true, trim: true },
		tags: { type: [String], default: [] },
		priority: { type: Number, default: 0 },
		programmes: {
			type: [
				{
					title: { type: String, required: true, trim: true },
					summary: { type: String, required: true, trim: true },
					imageObject: { type: String, required: true, trim: true },
				},
			],
			default: [],
		},
		socialLinks: {
			type: [
				{
					type: { type: String, required: true, trim: true },
					url: { type: String, required: true, trim: true },
				},
			],
			default: [],
		},
		givesStamp: { type: Boolean, default: false },
	},
	{ timestamps: true },
);

export type BoothDocument = InferSchemaType<typeof boothSchema>;

export const Booth = model<BoothDocument>("Booth", boothSchema);
