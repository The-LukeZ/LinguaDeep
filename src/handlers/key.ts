import { codeBlock, inlineCode, spoiler } from "@discordjs/formatters";
import { EphemeralFlag, makeDeeplClient, UserSetting } from "../utils.js";
import { ApplicationIntegrationType } from "discord-api-types/v10";
import { SlashCommandHandler } from "honocord";
import { MyContext } from "../types.js";

export const keyCommand = new SlashCommandHandler<MyContext>()
  .setName("key")
  .setDescription("Manage your API key")
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
  .addSubcommand((sub) =>
    sub
      .setName("set")
      .setDescription("Set your DeepL API key")
      .addStringOption((opt) => opt.setName("api_key").setDescription("Your DeepL API key").setRequired(true)),
  )
  .addSubcommand((sub) => sub.setName("remove").setDescription("Remove your DeepL API key"))
  .addSubcommand((sub) => sub.setName("view").setDescription("View your current DeepL API key"))
  .addHandler(async (ctx) => {
    const subcommand = ctx.options.getSubcommand(true);
    const userId = (ctx.member?.user?.id || ctx.user?.id)!;

    if (subcommand === "set") {
      const apiKey = ctx.options.getString("api_key", true);
      const cfg = new UserSetting(apiKey);
      await ctx.context.get("db").setKeyData(userId, cfg.deeplApiKey);
      await ctx.reply({ content: "### ✅ Your DeepL API key has been set successfully.", flags: EphemeralFlag });
      return;
    }

    if (subcommand === "remove") {
      await ctx.context.get("db").removeSettings(userId);
      await ctx.reply({ content: "### ✅ Your DeepL API key has been removed successfully.", flags: EphemeralFlag });
      return;
    }

    const cfg = await ctx.context.get("db").getSetting(userId);
    if (!cfg?.deeplApiKey) {
      await ctx.reply({ content: "### ⚠️ You have not set a DeepL API key yet.", flags: EphemeralFlag });
      return;
    }
    await ctx.deferReply(true);
    const deepl = makeDeeplClient(cfg);
    const usage = await deepl.getUsage();
    const percentUsed = usage.character && usage.character.limit ? ((usage.character.count / usage.character.limit) * 100).toFixed(2) : "0";
    return ctx.editReply({
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
              value: `**${cfg.deeplApiKey.endsWith(":fx") ? "Free" : "Pro"}**`,
              inline: true,
            },
            {
              name: "Characters Used",
              value: `${inlineCode(String(usage.character?.count || null))} / ${inlineCode(String(usage.character?.limit || null))} (${percentUsed}%)`,
              inline: true,
            },
            {
              name: "Any Limit Reached?",
              value: !!usage.character?.limitReached() ? "✅" : "❌",
              inline: true,
            },
          ],
        },
      ],
      flags: EphemeralFlag,
    });
  });
