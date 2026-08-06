import { Router } from "express";
import createHttpError from "http-errors";
import { Types } from "mongoose";
import { z } from "zod";

import { FACULTIES } from "../constants/student.js";
import { Building } from "../db/schema/building.js";
import { Event } from "../db/schema/event.js";
import { Location } from "../db/schema/location.js";
import { Suggestion } from "../db/schema/suggestion.js";
import { requireAdmin } from "../middleware/auth.js";
import { clearCache } from "../middleware/cache.js";
import { validateBody } from "../middleware/validateBody.js";
import { toEventDetailOutput } from "./event.js";

export const suggestionRouter = Router();

const suggestionParams = z.object({
	faculty: z.enum(FACULTIES),
	studyYear: z.coerce.number().int().min(1).max(3),
});

const suggestionInput = z.object({
	eventIds: z
		.array(z.string().refine(Types.ObjectId.isValid, "Invalid event ID"))
		.refine((ids) => new Set(ids).size === ids.length, "Duplicate event IDs"),
});

suggestionRouter.get("/:faculty/:studyYear", async (req, res) => {
	const params = suggestionParams.safeParse(req.params);

	if (!params.success) {
		throw createHttpError(400, "Invalid faculty or study year");
	}

	const suggestion = await Suggestion.findOne({
		faculty: params.data.faculty,
		studyYears: params.data.studyYear,
	}).lean();

	if (!suggestion) {
		throw createHttpError(404, "Suggestion not found");
	}

	const requiredEventIds = new Set(
		suggestion.eventIds.map((id) => id.toString()),
	);
	const suggestedEvents = [
		...suggestion.eventIds.map((id) => ({ id, optional: false })),
		...(suggestion.optionalEventIds ?? [])
			.filter((id) => !requiredEventIds.has(id.toString()))
			.map((id) => ({ id, optional: true })),
	];
	const events = await Event.find({
		_id: { $in: suggestedEvents.map(({ id }) => id) },
	}).lean();
	const eventsById = new Map(
		events.map((event) => [event._id.toString(), event]),
	);
	const orderedEvents = suggestedEvents.flatMap(({ id, optional }) => {
		const event = eventsById.get(id.toString());
		return event ? [{ event, optional }] : [];
	});
	const locations = await Location.find({
		_id: { $in: orderedEvents.map(({ event }) => event.locationId) },
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
		orderedEvents.map(({ event, optional }) => {
			const location = locationsById.get(event.locationId.toString());

			return {
				...toEventDetailOutput(
					event,
					location,
					location ? buildingsById.get(location.buildingId.toString()) : null,
				),
				optional,
			};
		}),
	);
});

suggestionRouter.put(
	"/:faculty/:studyYear",
	requireAdmin,
	validateBody(suggestionInput),
	async (req, res) => {
		const params = suggestionParams.safeParse(req.params);

		if (!params.success) {
			throw createHttpError(400, "Invalid faculty or study year");
		}

		const eventCount = await Event.countDocuments({
			_id: { $in: req.body.eventIds },
		});
		if (eventCount !== req.body.eventIds.length) {
			throw createHttpError(400, "One or more events do not exist");
		}

		const { faculty, studyYear } = params.data;
		await Suggestion.findOneAndUpdate(
			{ faculty, studyYears: studyYear },
			{
				$set: {
					faculty,
					studyYears: studyYear === 1 ? [1] : [2, 3],
					eventIds: req.body.eventIds,
				},
				$pull: { optionalEventIds: { $in: req.body.eventIds } },
			},
			{ upsert: true },
		);
		clearCache();

		return res.api(200, { eventIds: req.body.eventIds });
	},
);
