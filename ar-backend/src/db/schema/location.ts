import { Schema, model } from "mongoose";
import type { InferSchemaType } from "mongoose";

const locationSchema = new Schema(
	{
		name: { type: String, required: true, trim: true },
		buildingId: { type: Schema.Types.ObjectId, ref: "Building", required: true },
		floor: { type: String, trim: true },
		room: { type: String, trim: true },
	},
	{ timestamps: true },
);

locationSchema.index({ name: 1 });
locationSchema.index({ buildingId: 1, name: 1 });

export type LocationDocument = InferSchemaType<typeof locationSchema>;

export const Location = model<LocationDocument>("Location", locationSchema);
