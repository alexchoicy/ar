import { Schema, model } from "mongoose";
import type { InferSchemaType } from "mongoose";

import { INTERESTS } from "../../constants/student.js";

const eventSchema = new Schema(
	{
		title: { type: String, required: true, trim: true },
		description: { type: String, required: true, trim: true },
		startsAt: { type: Date, required: true },
		endsAt: { type: Date, required: true },
		locationId: { type: Schema.Types.ObjectId, ref: "Location", required: true },
		imageObject: { type: String, required: true, trim: true },
		category: { type: String, required: true, trim: true, enum: INTERESTS },
		tags: { type: [String], default: [] },
		isFeatured: { type: Boolean, default: false },
		priority: { type: Number, default: 0 },
	},
	{ timestamps: true },
);

eventSchema.index({ startsAt: 1, priority: -1 });
eventSchema.index({ locationId: 1, startsAt: 1, priority: -1 });

export type EventDocument = InferSchemaType<typeof eventSchema>;

export const Event = model<EventDocument>("Event", eventSchema);
