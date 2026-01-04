import { Command, Option, SubCommand } from "discord-hono";
import { factory } from "../init.js";
import { DBHelper, EphemeralFlag } from "../utils.js";
import { codeBlock, spoiler } from "@discordjs/formatters";

const command = new Command("key", "Manage your API key").options(
  new SubCommand("set", "Set your DeepL API key").options(new Option("api_key", "Your DeepL API key", "String").required(true)),
  new SubCommand("remove", "Remove your DeepL API key"),
  new SubCommand("view", "View your current DeepL API key"),
);

export const commandSettings = factory.command(command, async (c) => {
  c.set("db", new DBHelper(c.env.DB));
  const subcommand = c.sub.string;
  const userId = (c.interaction.user?.id || c.interaction.member?.user?.id)!;

  if (subcommand === "set") {
    const apiKey = c.var.api_key;
    await c.get("db").setSetting(userId, apiKey);
    return c.res({ content: "### ✅ Your DeepL API key has been set successfully.", flags: EphemeralFlag });
  }
  if (subcommand === "remove") {
    await c.get("db").removeSetting(userId);
    return c.res({ content: "### ✅ Your DeepL API key has been removed successfully.", flags: EphemeralFlag });
  }
  const existingKey = await c.get("db").getSetting(userId);
  if (!existingKey) {
    return c.res({ content: "### ⚠️ You have not set a DeepL API key yet.", flags: EphemeralFlag });
  }
  return c.res({ content: `### 🔑 Your current DeepL API key:\n${spoiler(codeBlock(existingKey))}`, flags: EphemeralFlag });
});
