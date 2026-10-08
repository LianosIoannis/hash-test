import express from "express";

// The healthy path is the real central application and temporary database.
// Faults are applied at its HTTP boundary, never inside authentication logic.
export async function startControlledCentral(integration) {
	const { createApp } = await import("../../src/server/app.ts");
	let failure;
	const app = express();
	app.use((request, response, next) => {
		if (failure === "disconnect") request.socket.destroy();
		else if (failure === "unavailable") response.sendStatus(503);
		else if (failure === "stall") {
			// Keep the connection open without headers until the caller aborts.
		} else if (failure === "body") {
			response.status(200).type("json").flushHeaders();
			response.write('{"mode":');
		} else next();
	});
	app.use(createApp());
	const origin = await integration.startServer(app);
	return {
		origin,
		fail: (value) => {
			failure = value;
		},
	};
}
