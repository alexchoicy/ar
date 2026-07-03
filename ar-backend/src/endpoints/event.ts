import { Router } from "express";
import createHttpError from "http-errors";
import { Types } from "mongoose";
import { z } from "zod";

import { Building } from "../db/schema/building.js";
import { Event } from "../db/schema/event.js";
import { Location } from "../db/schema/location.js";
import { requireAdmin } from "../middleware/auth.js";
import { clearCache } from "../middleware/cache.js";
import { validateBody } from "../middleware/validateBody.js";
import { createUploadUrl, getBlobUrl } from "../utils/blob.js";

export const eventRouter = Router();

const createEventInput = z.object({
	title: z.string().min(1),
	description: z.string().min(1),
	startsAt: z.coerce.date(),
	endsAt: z.coerce.date(),
	locationId: z
		.string()
		.refine(Types.ObjectId.isValid, "locationId must be a valid ObjectId"),
	imageFileName: z.string().min(1),
	imageContentType: z.string().min(1).optional(),
	imageSize: z.number().int().positive().optional(),
	category: z.string().min(1),
	tags: z.array(z.string()).default([]),
	isFeatured: z.boolean().default(false),
	priority: z.number().default(0),
});

function toEventOutput(event: any, location: any, building: any) {
	return {
		id: event._id.toString(),
		title: event.title,
		description: event.description,
		startsAt: event.startsAt,
		endsAt: event.endsAt,
		location: location
			? {
					id: location._id.toString(),
					name: location.name,
					floor: location.floor,
					room: location.room,
					building: building
						? {
								id: building._id.toString(),
								name: building.name,
								shortCode: building.shortCode,
								campusZone: building.campusZone,
								addressText: building.addressText,
								geo: building.geo,
							}
						: null,
				}
			: null,
		imageUrl: getBlobUrl(event.imageObject),
		category: event.category,
		tags: event.tags,
		isFeatured: event.isFeatured,
		priority: event.priority,
	};
}

eventRouter.get("/", async (_req, res) => {
	const events = await Event.find().sort({ startsAt: 1, priority: -1 }).lean();
	const locations = await Location.find({
		_id: { $in: events.map((event) => event.locationId) },
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
			events.map((event) => {
			const location = locationsById.get(event.locationId.toString());

			return toEventOutput(
				event,
				location,
				location ? buildingsById.get(location.buildingId.toString()) : null,
			);
		}),
	);
});

eventRouter.get("/:id", async (req, res) => {
	if (!Types.ObjectId.isValid(req.params.id)) {
		throw createHttpError(404, "Event not found");
	}

	const event = await Event.findById(req.params.id).lean();

	if (!event) {
		throw createHttpError(404, "Event not found");
	}

	const location = await Location.findById(event.locationId).lean();
	const building = location ? await Building.findById(location.buildingId).lean() : null;

	return res.api(200, toEventOutput(event, location, building));
});

eventRouter.post(
	"/",
	requireAdmin,
	validateBody(createEventInput),
	async (req, res) => {
		const { imageFileName, imageContentType, imageSize, ...eventInput } =
			req.body;
		const location = await Location.findById(eventInput.locationId).lean();

		if (!location) {
			throw createHttpError(404, "Location not found");
		}

		const building = await Building.findById(location.buildingId).lean();
		const eventId = new Types.ObjectId();
		const fileName = imageFileName.replaceAll(/[^\w.-]/g, "_");
		const imageObject = `events/${eventId.toString()}/${fileName}`;
		const uploadUrl = await createUploadUrl(imageObject);
		const event = await Event.create({
			_id: eventId,
			...eventInput,
			imageObject,
		});
		clearCache();

		return res.api(201, {
			event: toEventOutput(event, location, building),
			uploadUrl,
			fileName,
		});
	},
);
