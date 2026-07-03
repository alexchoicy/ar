import { Schema, model } from "mongoose";
import type { InferSchemaType } from "mongoose";

const locationSchema = new Schema(
	{
		name: { type: String, required: true, trim: true },
		buildingId: { type: Schema.Types.ObjectId, ref: "Building", required: true, index: true },
		floor: { type: String, trim: true },
		room: { type: String, trim: true },
	},
	{ timestamps: true },
);

export type LocationDocument = InferSchemaType<typeof locationSchema>;

export const Location = model<LocationDocument>("Location", locationSchema);
