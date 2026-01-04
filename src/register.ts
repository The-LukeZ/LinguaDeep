// This file supposed to be run by the `register` script in package.json (runs with tsx)

import { Command, Option, register } from "discord-hono";

// BYOK application for translations with the DeepL API
const commands = [
  new Command("translate", "Translate text using DeepL and your own key").options(
    new Option("text", "Text to translate", "String").required(true),
    new Option("target_lang", "Target language (e.g., en, de, fr) | Defaults to your client's language", "String")
      .required(false)
      .autocomplete(true),
    new Option("source_lang", "Source language (e.g., en, de, fr) | Auto-detected if not provided", "String").autocomplete(true),
  ),
  new Command("settings", "Configure your Settings"),
  new Command("help", "Get help with using the bot"),
];

register(commands, process.env.DISCORD_APPLICATION_ID, process.env.DISCORD_TOKEN);
