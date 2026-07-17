import { Router } from "express";
import createHttpError from "http-errors";
import { z } from "zod";

import { FACULTIES } from "../constants/student.js";
import { Building } from "../db/schema/building.js";
import { Event } from "../db/schema/event.js";
import { Location } from "../db/schema/location.js";
import { Suggestion } from "../db/schema/suggestion.js";
import { toEventDetailOutput } from "./event.js";

export const suggestionRouter = Router();

const suggestionParams = z.object({
	faculty: z.enum(FACULTIES),
	studyYear: z.coerce.number().int().min(1),
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

	const suggestedEvents = [
		...suggestion.eventIds.map((id) => ({ id, optional: false })),
		...(suggestion.optionalEventIds ?? []).map((id) => ({ id, optional: true })),
	];
	const events = await Event.find({
		_id: { $in: suggestedEvents.map(({ id }) => id) },
	}).lean();
	const eventsById = new Map(events.map((event) => [event._id.toString(), event]));
	const orderedEvents = suggestedEvents
		.flatMap(({ id, optional }) => {
			const event = eventsById.get(id.toString());
			return event ? [{ event, optional }] : [];
		})
		.sort((a, b) => a.event.startsAt.getTime() - b.event.startsAt.getTime());
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
