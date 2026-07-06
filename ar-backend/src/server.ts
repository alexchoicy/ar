import { fileURLToPath } from "node:url";

import express from "express";
import helmet from "helmet";

import { connectDb } from "./db/connection.js";
import { errorMiddleware, responseMiddleware } from "./middleware/response.js";
import { routes } from "./routes.js";
import { httpLogger, logger } from "./utils/logger.js";

const app = express();
const port = Number(process.env.PORT) || 3000;
const publicHtml = fileURLToPath(
	new URL("../public/Student-documentation.html", import.meta.url),
);
const uploadTestHtml = fileURLToPath(
	new URL("../public/upload-test.html", import.meta.url),
);

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false })); //this will be removed after dev
app.use(express.json());
app.use(httpLogger);
app.use(responseMiddleware);
app.get("/docs", (_request, response) => response.sendFile(publicHtml));
app.get("/upload-test", (_request, response) =>
	response.sendFile(uploadTestHtml),
);
app.use(routes);
app.use(errorMiddleware);

await connectDb();

app.listen(port, () => {
	logger.info(`Server running on :${port}`);
});
