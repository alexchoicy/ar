import { Router } from "express";
import createHttpError from "http-errors";
import { Types } from "mongoose";
import { z } from "zod";

import { Booth } from "../db/schema/booth.js";
import { Building } from "../db/schema/building.js";
import { Event } from "../db/schema/event.js";
import { Location } from "../db/schema/location.js";
import { requireAdmin } from "../middleware/auth.js";
import { clearCache } from "../middleware/cache.js";
import { validateBody } from "../middleware/validateBody.js";
import { getBlobUrl } from "../utils/blob.js";

export const locationRouter = Router();

const createLocationInput = z.object({
	name: z.string().min(1),
	buildingId: z.string().refine(Types.ObjectId.isValid, "buildingId must be a valid ObjectId"),
	floor: z.string().optional(),
	room: z.string().optional(),
});

export function groupByLocation<T extends { locationId: { toString(): string } }>(items: T[]) {
	const grouped = new Map<string, T[]>();

	for (const item of items) {
		const key = item.locationId.toString();
		grouped.set(key, [...(grouped.get(key) ?? []), item]);
	}

	return grouped;
}

export function toBuildingOutput(building: any) {
	return {
		id: building._id.toString(),
		name: building.name,
		shortCode: building.shortCode,
		campusZone: building.campusZone,
		addressText: building.addressText,
		geo: building.geo,
	};
}

export function toBoothOutput(booth: any) {
	return {
		id: booth._id.toString(),
		qrCode: booth.qrCode,
		boothCode: booth.boothCode,
		name: booth.name,
		overview: booth.overview,
		category: booth.category,
		startTime: booth.startTime,
		endTime: booth.endTime,
		imageUrl: getBlobUrl(booth.imageObject),
		tags: booth.tags,
		priority: booth.priority,
		programmes: booth.programmes.map((programme: any) => ({
			title: programme.title,
			summary: programme.summary,
			imageUrl: getBlobUrl(programme.imageObject),
		})),
		socialLinks: booth.socialLinks,
	};
}

export function toEventOutput(event: any) {
	return {
		id: event._id.toString(),
		title: event.title,
		description: event.description,
		startsAt: event.startsAt,
		endsAt: event.endsAt,
		imageUrl: getBlobUrl(event.imageObject),
		category: event.category,
		tags: event.tags,
		isFeatured: event.isFeatured,
		priority: event.priority,
	};
}

export function toLocationOutput(location: any, building: any, booths?: any[], events?: any[]) {
	return {
		id: location._id.toString(),
		name: location.name,
		floor: location.floor,
		room: location.room,
		...(building !== undefined ? { building: building ? toBuildingOutput(building) : null } : {}),
		...(booths || events
			? {
					booths: (booths ?? []).map(toBoothOutput),
					events: (events ?? []).map(toEventOutput),
				}
			: {}),
	};
}

locationRouter.get("/", async (_req, res) => {
	const locations = await Location.find().sort({ name: 1 }).lean();
	const buildings = await Building.find({ _id: { $in: locations.map((location) => location.buildingId) } }).lean();
	const buildingsById = new Map(buildings.map((building) => [building._id.toString(), building]));

	return res.api(
		200,
		locations.map((location) => toLocationOutput(location, buildingsById.get(location.buildingId.toString()))),
	);
});

locationRouter.get("/:id", async (req, res) => {
	if (!Types.ObjectId.isValid(req.params.id)) {
		throw createHttpError(404, "Location not found");
	}

	const [location, booths, events] = await Promise.all([
		Location.findById(req.params.id).lean(),
		Booth.find({ locationId: req.params.id }).sort({ priority: -1, name: 1 }).lean(),
		Event.find({ locationId: req.params.id }).sort({ startsAt: 1, priority: -1 }).lean(),
	]);

	if (!location) {
		throw createHttpError(404, "Location not found");
	}

	const building = await Building.findById(location.buildingId).lean();

	return res.api(200, toLocationOutput(location, building, booths, events));
});

locationRouter.post("/", requireAdmin, validateBody(createLocationInput), async (req, res) => {
	const building = await Building.exists({ _id: req.body.buildingId });

	if (!building) {
		throw createHttpError(404, "Building not found");
	}

	const location = await Location.create(req.body);
	clearCache();

	return res.api(201, {
		id: location.id,
		name: location.name,
		buildingId: location.buildingId.toString(),
		floor: location.floor,
		room: location.room,
	});
});
