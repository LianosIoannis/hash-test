import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

// Chromium DevTools Protocol, using Node's built-in WebSocket. Only isolated
// test profiles are launched; no installed user's browser session is attached.
export async function launchBrowser(directory, url) {
	const executable = process.env.BROWSER_EXECUTABLE ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
	if (!existsSync(executable)) throw new Error("Set BROWSER_EXECUTABLE to an installed Chromium or Edge executable");
	const child = spawn(
		executable,
		[
			"--headless",
			"--disable-gpu",
			"--no-first-run",
			"--no-default-browser-check",
			"--disable-extensions",
			"--remote-debugging-port=0",
			`--user-data-dir=${join(directory, "interactive-browser-profile")}`,
			"about:blank",
		],
		{ windowsHide: true, stdio: ["ignore", "ignore", "pipe"] },
	);
	let socket;
	const exit = once(child, "exit");
	void exit.catch(() => {});
	try {
		const address = await new Promise((resolve, reject) => {
			let output = "";
			const timeout = setTimeout(() => {
				reject(new Error("Browser startup timed out"));
			}, 15000);
			const fail = (error) => {
				clearTimeout(timeout);
				reject(error);
			};
			child.once("error", fail);
			child.once("exit", () => fail(new Error("Browser exited before debugging started")));
			child.stderr.on("data", (chunk) => {
				output = (output + chunk.toString()).slice(-8192);
				const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(output);
				if (match) {
					clearTimeout(timeout);
					resolve(match[1]);
				}
			});
		});
		socket = new WebSocket(address);
		await new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error("Browser connection timed out")), 15000);
			socket.addEventListener(
				"open",
				() => {
					clearTimeout(timer);
					resolve();
				},
				{ once: true },
			);
			socket.addEventListener(
				"error",
				() => {
					clearTimeout(timer);
					reject(new Error("Browser connection failed"));
				},
				{ once: true },
			);
		});
		let sequence = 0;
		const pending = new Map();
		socket.addEventListener("message", ({ data }) => {
			const message = JSON.parse(data);
			const request = pending.get(message.id);
			if (!request) return;
			pending.delete(message.id);
			clearTimeout(request.timeout);
			if (message.error) request.reject(new Error(message.error.message));
			else request.resolve(message.result);
		});
		socket.addEventListener("close", () => {
			for (const request of pending.values()) {
				clearTimeout(request.timeout);
				request.reject(new Error("Browser connection closed"));
			}
			pending.clear();
		});
		function command(method, params = {}, sessionId) {
			return new Promise((resolve, reject) => {
				const id = ++sequence;
				const timeout = setTimeout(() => {
					pending.delete(id);
					reject(new Error(`Browser command timed out: ${method}`));
				}, 15000);
				pending.set(id, { resolve, reject, timeout });
				socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
			});
		}
		const { targetId } = await command("Target.createTarget", { url });
		const { sessionId } = await command("Target.attachToTarget", { targetId, flatten: true });
		async function evaluate(expression) {
			const result = await command(
				"Runtime.evaluate",
				{ expression, returnByValue: true, awaitPromise: true },
				sessionId,
			);
			if (result.exceptionDetails) throw new Error("Browser expression failed");
			return result.result.value;
		}
		return {
			evaluate,
			async waitFor(expression) {
				const deadline = Date.now() + 15000;
				while (Date.now() < deadline) {
					if (await evaluate(expression)) return;
					await delay(50);
				}
				throw new Error(`Browser condition timed out: ${expression}`);
			},
			async reload() {
				await command("Page.reload", {}, sessionId);
			},
			async close() {
				try {
					await command("Browser.close");
				} catch {
					child.kill();
				}
				socket.close();
				await exit;
			},
		};
	} catch (error) {
		socket?.close();
		child.kill();
		await exit.catch(() => {});
		throw error;
	}
}
