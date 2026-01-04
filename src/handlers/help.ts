import { Command } from "discord-hono";
import { factory } from "../init.js";
import { EphemeralFlag } from "../utils.js";

export const commandHelp = factory.command(new Command("help", "Get help with using the bot"), (c) =>
  c.res({
    content:
      "- Use `/translate` to translate text using DeepL API.\n" +
      "- Configure your settings with `/settings`.\n\n" +
      "This bot is a BYOK (Bring Your Own Key) application, so make sure to set your DeepL API key with `/settings`.",
    flags: EphemeralFlag,
  }),
);
