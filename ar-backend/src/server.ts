import express from "express";
import { fileURLToPath } from "node:url";

import { connectDb } from "./db/connection.js";
import { errorMiddleware, responseMiddleware } from "./middleware/response.js";
import { routes } from "./routes.js";
import { httpLogger, logger } from "./utils/logger.js";

const app = express();
const port = Number(process.env.PORT) || 3000;
const publicHtml = fileURLToPath(new URL("../public/Student-documentation.html", import.meta.url));

app.use(express.json());
app.use(httpLogger);
app.use(responseMiddleware);
app.get("/docs", (_request, response) => response.sendFile(publicHtml));
app.use(routes);
app.use(errorMiddleware);

await connectDb();

app.listen(port, () => {
	logger.info(`Server running on :${port}`);
});
