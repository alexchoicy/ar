import { Router } from "express";

import { Building } from "../db/schema/building.js";

export const locationRouter = Router();

locationRouter.get("/buildings", async (_req, res) => {
	const buildings = await Building.find().sort({ campusZone: 1 }).lean();

	return res.api(
		200,
		buildings.map((building) => ({
			id: building._id.toString(),
			name: building.name,
			shortCode: building.shortCode,
			campusZone: building.campusZone,
			addressText: building.addressText,
			geo: building.geo,
		})),
	);
});
