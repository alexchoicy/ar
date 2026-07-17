import { Schema, model } from "mongoose";
import type { InferSchemaType } from "mongoose";

const eventSchema = new Schema(
	{
		refId: { type: String, trim: true },
		title: { type: String, required: true, trim: true },
		description: { type: String, required: true, trim: true },
		hidden: { type: Boolean, default: false },
		startsAt: { type: Date, required: true },
		endsAt: { type: Date, required: true },
		locationId: { type: Schema.Types.ObjectId, ref: "Location", required: true },
	},
	{ timestamps: true },
);

eventSchema.index({ refId: 1 }, { unique: true, sparse: true });
eventSchema.index({ startsAt: 1 });
eventSchema.index({ locationId: 1, startsAt: 1 });

export type EventDocument = InferSchemaType<typeof eventSchema>;

export const visibleEventFilter = { hidden: { $ne: true } };
export const Event = model<EventDocument>("Event", eventSchema);
