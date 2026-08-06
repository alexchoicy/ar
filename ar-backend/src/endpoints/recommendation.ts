import { Router } from "express";
import createHttpError from "http-errors";
import { Types } from "mongoose";
import { z } from "zod";

import { Booth } from "../db/schema/booth.js";
import { Building } from "../db/schema/building.js";
import { Location } from "../db/schema/location.js";
import { Recommendation } from "../db/schema/recommendation.js";
import { requireAdmin } from "../middleware/auth.js";
import { clearCache } from "../middleware/cache.js";
import { validateBody } from "../middleware/validateBody.js";
import { toBoothDetailOutput } from "./booth.js";

export const recommendationRouter = Router();

const recommendationInput = z.object({
	boothIds: z
		.array(z.string().refine(Types.ObjectId.isValid, "Invalid booth ID"))
		.refine((ids) => new Set(ids).size === ids.length, "Duplicate booth IDs"),
});

recommendationRouter.get("/", async (_req, res) => {
	const recommendations = await Recommendation.find()
		.sort({ createdAt: 1 })
		.lean();
	const boothIds = [
		...new Map(
			recommendations
				.flatMap((recommendation) => recommendation.boothIds)
				.map((id) => [id.toString(), id]),
		).values(),
	];
	const booths = await Booth.find({ _id: { $in: boothIds } }).lean();
	const boothsById = new Map(
		booths.map((booth) => [booth._id.toString(), booth]),
	);
	const orderedBooths = boothIds.flatMap((id) => {
		const booth = boothsById.get(id.toString());
		return booth ? [booth] : [];
	});
	const locations = await Location.find({
		_id: { $in: orderedBooths.flatMap((booth) => booth.locationId ?? []) },
	}).lean();
	const buildings = await Building.find({
		_id: { $in: locations.map((location) => location.buildingId) },
	}).lean();
	const locationsById = new Map(
		locations.map((location) => [location._id.toString(), location]),
	);
	const buildingsById = new Map(
		buildings.map((building) => [building._id.toString(), building]),
	);

	return res.api(
		200,
		orderedBooths.map((booth) => {
			const location = booth.locationId
				? locationsById.get(booth.locationId.toString())
				: undefined;

			return toBoothDetailOutput(
				booth,
				location,
				location ? buildingsById.get(location.buildingId.toString()) : null,
			);
		}),
	);
});

recommendationRouter.put(
	"/",
	requireAdmin,
	validateBody(recommendationInput),
	async (req, res) => {
		const boothCount = await Booth.countDocuments({
			_id: { $in: req.body.boothIds },
		});
		if (boothCount !== req.body.boothIds.length) {
			throw createHttpError(400, "One or more booths do not exist");
		}

		const recommendation = await Recommendation.findOneAndUpdate(
			{},
			{ $set: { boothIds: req.body.boothIds } },
			{ new: true, sort: { createdAt: 1 }, upsert: true },
		);
		await Recommendation.deleteMany({ _id: { $ne: recommendation._id } });
		clearCache();

		return res.api(200, { boothIds: req.body.boothIds });
	},
);
