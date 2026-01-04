import { Command } from "discord-hono";
import { factory } from "../init.js";

export const commandSettings = factory.command(new Command("settings", "Configure your Settings"), async (c) =>
  c.res("Work in progress..."),
);
