import { DiscordHono } from "discord-hono";

const app = new DiscordHono();

app.command("ping", (c) => c.res("Pong!!"));

export default app;
