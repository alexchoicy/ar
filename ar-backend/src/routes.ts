import { Router } from "express";

import { adminAuthRouter, authRouter } from "./endpoints/auth.js";
import { boothRouter } from "./endpoints/booth.js";
import { buildingRouter } from "./endpoints/building.js";
import { eventRouter } from "./endpoints/event.js";
import { locationRouter } from "./endpoints/location.js";
import { userRouter } from "./endpoints/user.js";
import { cacheGet } from "./middleware/cache.js";

export const routes = Router();
const publicGetCache = cacheGet();

routes.use("/api/auth", authRouter);
routes.use("/api/admin", adminAuthRouter);
routes.use("/api/booths", publicGetCache, boothRouter);
routes.use("/api/buildings", publicGetCache, buildingRouter);
routes.use("/api/events", publicGetCache, eventRouter);
routes.use("/api/locations", publicGetCache, locationRouter);
routes.use("/api/users", userRouter);
