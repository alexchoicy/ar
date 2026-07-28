import { Schema, model } from "mongoose";
import type { InferSchemaType } from "mongoose";

const recommendationSchema = new Schema(
	{
		boothIds: {
			type: [{ type: Schema.Types.ObjectId, ref: "Booth" }],
			required: true,
			default: [],
		},
	},
	{ timestamps: true },
);

export type RecommendationDocument = InferSchemaType<
	typeof recommendationSchema
>;

export const Recommendation = model<RecommendationDocument>(
	"Recommendation",
	recommendationSchema,
);
