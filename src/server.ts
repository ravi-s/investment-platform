import { createServer } from "node:http";
import { handleUserRoute } from "./routes/user.ts";
import "./database.ts";

const server = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");

    handleUserRoute(req, res);
});

server.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});