import { Router } from "express";

import { authRouter } from "./endpoints/auth.js";
import { boothRouter } from "./endpoints/booth.js";
import { buildingRouter } from "./endpoints/building.js";
import { eventRouter } from "./endpoints/event.js";
import { locationRouter } from "./endpoints/location.js";
import { userRouter } from "./endpoints/user.js";

export const routes = Router();

routes.use("/api/auth", authRouter);
routes.use("/api/booths", boothRouter);
routes.use("/api/buildings", buildingRouter);
routes.use("/api/events", eventRouter);
routes.use("/api/locations", locationRouter);
routes.use("/api/users", userRouter);
