import { Schema, model } from "mongoose";
import type { InferSchemaType } from "mongoose";

const buildingSchema = new Schema(
	{
		name: { type: String, required: true, trim: true },
		shortCode: { type: String, required: true, unique: true, trim: true },
		campusZone: { type: String, required: true, trim: true },
		addressText: { type: String, required: true, trim: true },
		geo: {
			type: [Number],
			required: true,
			validate: (value: number[]) =>
				value.length === 2 && value[0] >= -180 && value[0] <= 180 && value[1] >= -90 && value[1] <= 90,
		},
	},
	{ timestamps: true },
);

export type BuildingDocument = InferSchemaType<typeof buildingSchema>;

export const Building = model<BuildingDocument>("Building", buildingSchema);
