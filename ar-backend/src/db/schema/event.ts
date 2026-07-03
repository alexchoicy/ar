import { Schema, model } from "mongoose";
import type { InferSchemaType } from "mongoose";

const eventSchema = new Schema(
	{
		title: { type: String, required: true, trim: true },
		description: { type: String, required: true, trim: true },
		startsAt: { type: Date, required: true },
		endsAt: { type: Date, required: true },
		locationId: { type: Schema.Types.ObjectId, ref: "Location", required: true, index: true },
		imageObject: { type: String, required: true, trim: true },
		category: { type: String, required: true, trim: true },
		tags: { type: [String], default: [] },
		isFeatured: { type: Boolean, default: false },
		priority: { type: Number, default: 0 },
	},
	{ timestamps: true },
);

export type EventDocument = InferSchemaType<typeof eventSchema>;

export const Event = model<EventDocument>("Event", eventSchema);
