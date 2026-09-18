import type { ServerResponse } from "node:http";

export function sendJson(
    res: ServerResponse,
    statusCode: number,
    data: unknown,
): void {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data));
}