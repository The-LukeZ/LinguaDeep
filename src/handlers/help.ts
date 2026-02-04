import { EphemeralFlag } from "../utils.js";
import { ApplicationIntegrationType } from "discord-api-types/payloads/v10";
import { SlashCommandHandler, ActionRowBuilder, ButtonBuilder } from "honocord";

export const helpCommand = new SlashCommandHandler()
  .setName("help")
  .setDescription("Get help with using the bot")
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
  .addHandler(async (ctx) => {
    return ctx.reply({
      content: [
        "### 🤖 LinguaDeep",
        "- Use `/translate` to translate text using DeepL API.",
        "  - Target language defaults to your set preferred language or your client's language.",
        "  - Source language is auto-detected by DeepL if not set.",
        "- Use `/preferred-language` to set or clear your preferred target language.",
        "- Configure your API key settings with `/key`.",
        "",
        "This bot is a BYOK (Bring Your Own Key) application, so make sure to set your DeepL API key with `/key set`.",
        "-# The key is stored securely (encrypted) in the database and only used to make requests to DeepL on your behalf.",
      ].join("\n"),
      components: [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(new ButtonBuilder().setURL("https://github.com/The-LukeZ/LinguaDeep/wiki").setStyle(5).setLabel("User Wiki"))
          .toJSON(),
      ],
      flags: EphemeralFlag,
    });
  });
