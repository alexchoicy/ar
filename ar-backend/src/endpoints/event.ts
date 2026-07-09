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
import { deleteRecordById } from "./helpers.js";
import {
	findOrCreateLocation,
	toEventOutput,
	toLocationOutput,
} from "./location.js";

export const eventRouter = Router();

const refIdInput = z.preprocess(
	(value) => (value === "" ? undefined : value),
	z.string().min(1).optional(),
);

const eventInputShape = {
	refId: refIdInput,
	title: z.string().min(1),
	description: z.string().min(1),
	startsAt: z.coerce.date(),
	endsAt: z.coerce.date(),
	buildingId: z
		.string()
		.refine(Types.ObjectId.isValid, "buildingId must be a valid ObjectId"),
	floor: z.string().default(""),
	room: z.string().default(""),
};

const createEventInput = z
	.object(eventInputShape)
	.refine(
		(input) => input.startsAt < input.endsAt,
		"startsAt must be before endsAt",
	);

const updateEventInput = z
	.object(eventInputShape)
	.refine(
		(input) => input.startsAt < input.endsAt,
		"startsAt must be before endsAt",
	);

function toEventDetailOutput(event: any, location: any, building: any) {
	return {
		...toEventOutput(event),
		location: location ? toLocationOutput(location, building) : null,
	};
}

eventRouter.get("/", async (_req, res) => {
	const events = await Event.find().sort({ startsAt: 1 }).lean();
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

			return toEventDetailOutput(
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
	const building = location
		? await Building.findById(location.buildingId).lean()
		: null;

	return res.api(200, toEventDetailOutput(event, location, building));
});

eventRouter.post(
	"/",
	requireAdmin,
	validateBody(createEventInput),
	async (req, res) => {
		const { location, building } = await findOrCreateLocation(
			req.body.buildingId,
			req.body.floor,
			req.body.room,
		);
		const event = await Event.create({
			...(req.body.refId ? { refId: req.body.refId } : {}),
			title: req.body.title,
			description: req.body.description,
			startsAt: req.body.startsAt,
			endsAt: req.body.endsAt,
			locationId: location._id,
		});
		clearCache();

		return res.api(201, {
			event: toEventDetailOutput(event, location, building),
		});
	},
);

eventRouter.put(
	"/:id",
	requireAdmin,
	validateBody(updateEventInput),
	async (req, res) => {
		const id = req.params.id as string;

		if (!Types.ObjectId.isValid(id)) {
			throw createHttpError(404, "Event not found");
		}

		const { location, building } = await findOrCreateLocation(
			req.body.buildingId,
			req.body.floor,
			req.body.room,
		);
		const event = await Event.findByIdAndUpdate(
			id,
			{
				...(req.body.refId ? { refId: req.body.refId } : {}),
				title: req.body.title,
				description: req.body.description,
				startsAt: req.body.startsAt,
				endsAt: req.body.endsAt,
				locationId: location._id,
			},
			{ new: true },
		).lean();

		if (!event) {
			throw createHttpError(404, "Event not found");
		}

		clearCache();

		return res.api(200, {
			event: toEventDetailOutput(event, location, building),
		});
	},
);

eventRouter.delete("/:id", requireAdmin, async (req, res) => {
	const id = req.params.id as string;
	await deleteRecordById(Event, id, "Event");

	return res.api(200, { id });
});
