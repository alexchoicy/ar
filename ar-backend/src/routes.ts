import { Router } from "express";

import { authRouter } from "./endpoints/auth.js";
import { userRouter } from "./endpoints/user.js";

export const routes = Router();

routes.use("/api/auth", authRouter);
routes.use("/api/users", userRouter);
