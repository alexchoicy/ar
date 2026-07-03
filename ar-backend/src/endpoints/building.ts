import { Router } from "express";
import createHttpError from "http-errors";
import { Types } from "mongoose";

import { Booth } from "../db/schema/booth.js";
import { Building } from "../db/schema/building.js";
import { Event } from "../db/schema/event.js";
import { Location } from "../db/schema/location.js";
import { groupByLocation, toBuildingOutput, toLocationOutput } from "./location.js";

export const buildingRouter = Router();

buildingRouter.get("/", async (_req, res) => {
	const buildings = await Building.find().sort({ campusZone: 1, name: 1 }).lean();

	return res.api(200, buildings.map(toBuildingOutput));
});

buildingRouter.get("/:id", async (req, res) => {
	if (!Types.ObjectId.isValid(req.params.id)) {
		throw createHttpError(404, "Building not found");
	}

	const building = await Building.findById(req.params.id).lean();

	if (!building) {
		throw createHttpError(404, "Building not found");
	}

	const locations = await Location.find({ buildingId: building._id }).sort({ name: 1 }).lean();
	const locationIds = locations.map((location) => location._id);
	const booths = await Booth.find({ locationId: { $in: locationIds } }).sort({ priority: -1, name: 1 }).lean();
	const events = await Event.find({ locationId: { $in: locationIds } }).sort({ startsAt: 1, priority: -1 }).lean();
	const boothsByLocation = groupByLocation(booths);
	const eventsByLocation = groupByLocation(events);

	return res.api(200, {
		...toBuildingOutput(building),
		locations: locations.map((location) =>
			toLocationOutput(
				location,
				undefined,
				boothsByLocation.get(location._id.toString()) ?? [],
				eventsByLocation.get(location._id.toString()) ?? [],
			),
		),
	});
});
