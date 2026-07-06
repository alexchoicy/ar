import { Router } from "express";
import createHttpError from "http-errors";
import { Types } from "mongoose";
import { z } from "zod";

import { INTERESTS } from "../constants/student.js";
import { Booth } from "../db/schema/booth.js";
import { Building } from "../db/schema/building.js";
import { Location } from "../db/schema/location.js";
import { requireAdmin } from "../middleware/auth.js";
import { clearCache } from "../middleware/cache.js";
import { validateBody } from "../middleware/validateBody.js";
import { createUploadUrl } from "../utils/blob.js";
import { toBuildingOutput, toBoothOutput } from "./location.js";

export const boothRouter = Router();

const createBoothInput = z.object({
	boothCode: z.string().min(1),
	name: z.string().min(1),
	overview: z.string().min(1),
	category: z.enum(INTERESTS),
	locationId: z.string().refine(Types.ObjectId.isValid, "locationId must be a valid ObjectId"),
	startTime: z.string().min(1),
	endTime: z.string().min(1),
	imageFileName: z.string().min(1),
	tags: z.array(z.string()).default([]),
	priority: z.number().default(0),
	programmes: z
		.array(
			z.object({
				title: z.string().min(1),
				summary: z.string().min(1),
				imageFileName: z.string().min(1),
			}),
		)
		.default([]),
	socialLinks: z
		.array(
			z.object({
				type: z.string().min(1),
				url: z.string().url(),
			}),
		)
		.default([]),
	givesStamp: z.boolean().default(false),
});

function toBoothDetailOutput(booth: any, location: any, building: any) {
	return {
		...toBoothOutput(booth),
		location: location
			? {
					id: location._id.toString(),
					name: location.name,
					floor: location.floor,
					room: location.room,
					building: building ? toBuildingOutput(building) : null,
				}
			: null,
	};
}

async function getLocationAndBuilding(locationId: any) {
	const location = await Location.findById(locationId).lean();

	if (!location) {
		throw createHttpError(404, "Location not found");
	}

	return {
		location,
		building: await Building.findById(location.buildingId).lean(),
	};
}

boothRouter.get("/", async (_req, res) => {
	const booths = await Booth.find().sort({ priority: -1, name: 1 }).lean();
	const locations = await Location.find({ _id: { $in: booths.map((booth) => booth.locationId) } }).lean();
	const buildings = await Building.find({ _id: { $in: locations.map((location) => location.buildingId) } }).lean();
	const locationsById = new Map(locations.map((location) => [location._id.toString(), location]));
	const buildingsById = new Map(buildings.map((building) => [building._id.toString(), building]));

	return res.api(
		200,
		booths.map((booth) => {
			const location = locationsById.get(booth.locationId.toString());

			return toBoothDetailOutput(booth, location, location ? buildingsById.get(location.buildingId.toString()) : null);
		}),
	);
});

boothRouter.get("/:id", async (req, res) => {
	if (!Types.ObjectId.isValid(req.params.id)) {
		throw createHttpError(404, "Booth not found");
	}

	const booth = await Booth.findById(req.params.id).lean();

	if (!booth) {
		throw createHttpError(404, "Booth not found");
	}

	const { location, building } = await getLocationAndBuilding(booth.locationId);

	return res.api(200, toBoothDetailOutput(booth, location, building));
});

boothRouter.post("/", requireAdmin, validateBody(createBoothInput), async (req, res) => {
	const { location, building } = await getLocationAndBuilding(req.body.locationId);
	const boothId = new Types.ObjectId();
	const fileName = req.body.imageFileName.replaceAll(/[^\w.-]/g, "_");
	const imageObject = `booths/${boothId.toString()}/${fileName}`;
	const programmes = req.body.programmes.map((programme: any, index: number) => {
		const programmeFileName = programme.imageFileName.replaceAll(/[^\w.-]/g, "_");

		return {
			title: programme.title,
			summary: programme.summary,
			imageObject: `booths/${boothId.toString()}/programmes/${index}-${programmeFileName}`,
		};
	});
	const [uploadUrl, ...programmeUploadUrls] = await Promise.all([
		createUploadUrl(imageObject),
		...programmes.map((programme: any) => createUploadUrl(programme.imageObject)),
	]);
	const booth = await Booth.create({
		_id: boothId,
		boothCode: req.body.boothCode,
		name: req.body.name,
		overview: req.body.overview,
		category: req.body.category,
		locationId: req.body.locationId,
		startTime: req.body.startTime,
		endTime: req.body.endTime,
		imageObject,
		tags: req.body.tags,
		priority: req.body.priority,
		programmes,
		socialLinks: req.body.socialLinks,
		givesStamp: req.body.givesStamp,
	});
	clearCache();

	return res.api(201, {
		booth: toBoothDetailOutput(booth, location, building),
		uploadUrl,
		programmeUploadUrls,
	});
});
