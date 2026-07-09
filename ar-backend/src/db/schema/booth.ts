import { createHash } from "node:crypto";

import { Schema, model } from "mongoose";
import type { InferSchemaType } from "mongoose";

import { INTERESTS } from "../../constants/student.js";

export function createBoothQrCode(id: { toString(): string }) {
	return createHash("sha256").update(`${id.toString()}WHY ARE U WATCHING`).digest("hex");
}

const boothSchema = new Schema(
	{
		refId: { type: String, trim: true },
		boothCode: { type: String, required: true, unique: true, trim: true },
		name: { type: String, required: true, trim: true },
		overview: { type: String, required: true, trim: true },
		category: { type: String, required: true, trim: true, enum: INTERESTS },
		locationId: { type: Schema.Types.ObjectId, ref: "Location", required: true },
		startTime: { type: String, required: true, trim: true },
		endTime: { type: String, required: true, trim: true },
		tags: { type: [String], default: [] },
		priority: { type: Number, default: 0 },
		programmes: {
			type: [
				{
					title: { type: String, required: true, trim: true },
					summary: { type: String, required: true, trim: true },
					imageFileName: { type: String, required: true, trim: true },
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
		qrCode: {
			type: String,
			default: function () {
				return createBoothQrCode(this._id);
			},
			required: true,
			unique: true,
			trim: true,
		},
	},
	{ timestamps: true },
);

boothSchema.index({ refId: 1 }, { unique: true, sparse: true });
boothSchema.index({ priority: -1, name: 1 });
boothSchema.index({ locationId: 1, priority: -1, name: 1 });

export type BoothDocument = InferSchemaType<typeof boothSchema>;

export const Booth = model<BoothDocument>("Booth", boothSchema);
