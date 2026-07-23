import { fileURLToPath } from "node:url";
import path from "node:path";

import express from "express";
import helmet from "helmet";

import { connectDb } from "./db/connection.js";
import { errorMiddleware, responseMiddleware } from "./middleware/response.js";
import { routes } from "./routes.js";
import { httpLogger, logger } from "./utils/logger.js";

const app = express();
const port = Number(process.env.PORT) || 3000;
const publicDir = fileURLToPath(new URL("../public", import.meta.url));
const adminIndex = path.join(publicDir, "admin", "index.html");
const blobAccountName = process.env.AZURE_STORAGE_BLOB_ACCOUNT_NAME;
const blobSources = blobAccountName
	? [`https://${blobAccountName}.blob.core.windows.net`]
	: [];

app.disable("x-powered-by");
app.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				connectSrc: ["'self'", ...blobSources],
				imgSrc: ["'self'", "data:", ...blobSources],
			},
		},
	}),
);
app.use(express.json());
app.use(httpLogger);
app.use(responseMiddleware);
app.use("/admin", express.static(path.join(publicDir, "admin")));
app.use(express.static(publicDir));
app.use(routes);
app.get(/^\/admin(?:\/.*)?$/, (_request, response) =>
	response.sendFile(adminIndex),
);
app.use(errorMiddleware);

await connectDb();

app.listen(port, () => {
	logger.info(`Server running on :${port}`);
});
