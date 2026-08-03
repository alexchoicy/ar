import { Router } from "express";

import { Booth } from "../db/schema/booth.js";
import { Building } from "../db/schema/building.js";
import { Location } from "../db/schema/location.js";
import { Recommendation } from "../db/schema/recommendation.js";
import { toBoothDetailOutput } from "./booth.js";

export const recommendationRouter = Router();

recommendationRouter.get("/", async (_req, res) => {
	const recommendations = await Recommendation.find().sort({ createdAt: 1 }).lean();
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
