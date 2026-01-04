import { Command, Option, SubCommand } from "discord-hono";
import { factory } from "../init.js";
import { DBHelper, DeeplVersion, EphemeralFlag, makeDeeplClient, UserSetting } from "../utils.js";
import { codeBlock, inlineCode, spoiler } from "@discordjs/formatters";

const command = new Command("key", "Manage your API key").options(
  new SubCommand("set", "Set your DeepL API key").options(
    new Option("api_key", "Your DeepL API key", "String").required(true),
    new Option("deepl_version", "DeepL API version (Free or Pro)", "Integer")
      .choices(
        {
          name: "Free",
          value: DeeplVersion.Free,
        },
        {
          name: "Pro",
          value: DeeplVersion.Pro,
        },
      )
      .required(true),
  ),
  new SubCommand("remove", "Remove your DeepL API key"),
  new SubCommand("view", "View your current DeepL API key"),
);

export const commandSettings = factory.command(command, async (c) => {
  c.set("db", new DBHelper(c.env.DB));
  const subcommand = c.sub.string;
  const userId = (c.interaction.user?.id || c.interaction.member?.user?.id)!;

  if (subcommand === "set") {
    const cfg = new UserSetting(c.var.api_key, (c.var.deepl_version as DeeplVersion) || 1);
    await c.get("db").setSetting(userId, cfg.deeplApiKey, cfg.deeplVersion);
    return c.res({ content: "### ✅ Your DeepL API key has been set successfully.", flags: EphemeralFlag });
  }

  if (subcommand === "remove") {
    await c.get("db").removeSetting(userId);
    return c.res({ content: "### ✅ Your DeepL API key has been removed successfully.", flags: EphemeralFlag });
  }

  const cfg = await c.get("db").getSetting(userId);
  if (!cfg) {
    return c.res({ content: "### ⚠️ You have not set a DeepL API key yet.", flags: EphemeralFlag });
  }
  const deepl = makeDeeplClient(cfg);
  const usage = await deepl.getUsage();
  return c.res({
    // content: `### 🔑 Your current DeepL API key:\n${spoiler(codeBlock(cfg.deeplApiKey))}\n- **DeepL Plan:** ${DeeplVersion[cfg.deeplVersion]}\n- **Characters Used:** \`${usage.character?.count || "null"}\` / \`${usage.character?.limit || "null"}\``,
    embeds: [
      {
        title: "🔑 Your DeepL API Key Information",
        fields: [
          {
            name: "API Key",
            value: spoiler(codeBlock(cfg.deeplApiKey)),
          },
          {
            name: "DeepL Plan",
            value: `**${DeeplVersion[cfg.deeplVersion]}**`,
            inline: true,
          },
          {
            name: "Characters Used",
            value: `${inlineCode(String(usage.character?.count || null))} / ${inlineCode(String(usage.character?.limit || null))}`,
            inline: true,
          },
          {
            name: "Any Limit Reached?",
            value: usage.character?.limitReached ? "✅" : "❌",
            inline: true,
          },
        ],
      },
    ],
    flags: EphemeralFlag,
  });
});
