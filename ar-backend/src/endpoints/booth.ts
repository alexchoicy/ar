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
import { createUploadUrl, sanitizeBlobFileName } from "../utils/blob.js";
import { deleteRecordById } from "./helpers.js";
import {
	findOrCreateLocation,
	toBoothOutput,
	toLocationOutput,
} from "./location.js";

export const boothRouter = Router();

const refIdInput = z.preprocess(
	(value) => (value === "" ? undefined : value),
	z.string().min(1).optional(),
);

const programmeInput = z.object({
	id: z
		.string()
		.refine(Types.ObjectId.isValid, "id must be a valid ObjectId")
		.optional(),
	title: z.string().min(1),
	summary: z.string().min(1),
	imageFileName: z.string().min(1),
});

const boothInput = z
	.object({
		refId: refIdInput,
		name: z.string().min(1),
		overview: z.string().min(1),
		category: z.enum(INTERESTS),
		buildingId: z
			.string()
			.refine(Types.ObjectId.isValid, "buildingId must be a valid ObjectId"),
		floor: z.string().default(""),
		room: z.string().default(""),
		startTime: z.string().min(1),
		endTime: z.string().min(1),
		socialLinks: z
			.array(
				z.object({
					type: z.string().min(1),
					url: z.string().url(),
				}),
			)
			.default([]),
		programmes: z.array(programmeInput).default([]),
	})
	.refine(
		(input) => input.startTime < input.endTime,
		"startTime must be before endTime",
	);

function createProgrammeImageObject(
	boothId: string,
	programmeId: Types.ObjectId,
	imageFileName: string,
) {
	return `booths/${boothId}/programmes/${programmeId.toString()}-${sanitizeBlobFileName(imageFileName)}`;
}

function buildProgrammes(
	boothId: string,
	inputs: z.infer<typeof programmeInput>[],
	existingProgrammes: any[] = [],
) {
	const existingById = new Map(
		existingProgrammes.map((programme) => [
			programme._id?.toString(),
			programme,
		]),
	);
	const uploadObjects: Array<{ index: number; imageObject: string }> = [];
	const programmes = inputs.map((programme, index) => {
		const existing = programme.id ? existingById.get(programme.id) : undefined;
		const programmeId = existing?._id ?? new Types.ObjectId();
		const hasExistingImage =
			existing?.imageFileName === programme.imageFileName;
		const imageObject = hasExistingImage
			? existing.imageObject
			: createProgrammeImageObject(
					boothId,
					programmeId,
					programme.imageFileName,
				);

		uploadObjects.push({ index, imageObject });

		return {
			_id: programmeId,
			title: programme.title,
			summary: programme.summary,
			imageFileName: programme.imageFileName,
			imageObject,
		};
	});

	return { programmes, uploadObjects };
}

function toBoothDetailOutput(booth: any, location: any, building: any) {
	return {
		...toBoothOutput(booth),
		location: location ? toLocationOutput(location, building) : null,
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
	const locations = await Location.find({
		_id: { $in: booths.map((booth) => booth.locationId) },
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
		booths.map((booth) => {
			const location = locationsById.get(booth.locationId.toString());

			return toBoothDetailOutput(
				booth,
				location,
				location ? buildingsById.get(location.buildingId.toString()) : null,
			);
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

boothRouter.post(
	"/",
	requireAdmin,
	validateBody(boothInput),
	async (req, res) => {
		const boothId = new Types.ObjectId();
		const { location, building } = await findOrCreateLocation(
			req.body.buildingId,
			req.body.floor,
			req.body.room,
		);
		const { programmes, uploadObjects } = buildProgrammes(
			boothId.toString(),
			req.body.programmes,
		);
		const booth = await Booth.create({
			_id: boothId,
			...(req.body.refId ? { refId: req.body.refId } : {}),
			boothCode: `B-${boothId.toString().slice(-6).toUpperCase()}`,
			name: req.body.name,
			overview: req.body.overview,
			category: req.body.category,
			locationId: location._id,
			startTime: req.body.startTime,
			endTime: req.body.endTime,
			programmes,
			socialLinks: req.body.socialLinks,
		});
		clearCache();

		return res.api(201, {
			booth: toBoothDetailOutput(booth, location, building),
			programmeUploadUrls: await Promise.all(
				uploadObjects.map(async (item) => ({
					index: item.index,
					uploadUrl: await createUploadUrl(item.imageObject),
				})),
			),
		});
	},
);

boothRouter.put(
	"/:id",
	requireAdmin,
	validateBody(boothInput),
	async (req, res) => {
		const id = req.params.id as string;

		if (!Types.ObjectId.isValid(id)) {
			throw createHttpError(404, "Booth not found");
		}

		const existingBooth = await Booth.findById(id).lean();

		if (!existingBooth) {
			throw createHttpError(404, "Booth not found");
		}

		const { location, building } = await findOrCreateLocation(
			req.body.buildingId,
			req.body.floor,
			req.body.room,
		);
		const { programmes, uploadObjects } = buildProgrammes(
			id,
			req.body.programmes,
			existingBooth.programmes,
		);
		const $set: Record<string, unknown> = {
			name: req.body.name,
			overview: req.body.overview,
			category: req.body.category,
			locationId: location._id,
			startTime: req.body.startTime,
			endTime: req.body.endTime,
			programmes,
			socialLinks: req.body.socialLinks,
		};
		if (req.body.refId) $set.refId = req.body.refId;

		const booth = await Booth.findByIdAndUpdate(
			id,
			req.body.refId ? { $set } : { $set, $unset: { refId: "" } },
			{ new: true },
		).lean();

		if (!booth) {
			throw createHttpError(404, "Booth not found");
		}

		clearCache();

		return res.api(200, {
			booth: toBoothDetailOutput(booth, location, building),
			programmeUploadUrls: await Promise.all(
				uploadObjects.map(async (item) => ({
					index: item.index,
					uploadUrl: await createUploadUrl(item.imageObject),
				})),
			),
		});
	},
);

boothRouter.delete("/:id", requireAdmin, async (req, res) => {
	const id = req.params.id as string;
	await deleteRecordById(Booth, id, "Booth");

	return res.api(200, { id });
});
