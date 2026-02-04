import { TargetLanguageCode } from "deepl-node";
import { ApplicationIntegrationType } from "discord-api-types/v10";
import { ackRequest, AllLanguages, Autocomplete, DBHelper, errorResponse, getUserIdFromInteraction, TargetLanguages } from "../utils.js";
import { SlashCommandHandler } from "honocord";
import { MyContext } from "../types.js";

export const preferredLanguageCommand = new SlashCommandHandler<MyContext>()
  .setName("preferred-language")
  .setDescription("Set your preferred target language for translations")
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
  .addSubcommand((sub) =>
    sub
      .setName("set")
      .setDescription("Set your preferred target language")
      .addStringOption((opt) =>
        opt
          .setName("language")
          .setDescription("Preferred target language (e.g., en, de, fr)")
          .setRequired(true)
          .setAutocomplete(true)
          .setMinLength(2)
          .setMaxLength(7),
      ),
  )
  .addSubcommand((sub) => sub.setName("clear").setDescription("Clear your preferred target language"))
  .addAutocompleteHandler(async (ctx) => {
    const option = ctx.options.getFocused();
    if (!option || option.name !== "language") return ackRequest();
    return ctx.respond(
      new Autocomplete(option.value).choices(...TargetLanguages.map((code) => ({ name: AllLanguages[code], value: code }))).toJSON(),
    );
  })
  .addHandler(async (ctx) => {
    await ctx.deferReply(true);
    const userId = getUserIdFromInteraction(ctx);
    if (ctx.options.getSubcommand(true) === "clear") {
      const userCfg = await ctx.context.get("db").getSetting(userId);
      if (!userCfg?.deeplApiKey) {
        await ctx.context.get("db").removeSettings(userId);
      }
      await ctx.context.get("db").setPreferredLanguage(userId, null);
      return ctx.editReply("### ✅ Preferred language cleared. Translations will now use your client's language.");
    }

    const targetCandidate = (ctx.options.getString("language", true) || "").trim();
    if (!targetCandidate) {
      return ctx.editReply(errorResponse("Language is required. Please specify it using the `language` option."));
    }
    if (!TargetLanguages.includes(targetCandidate as TargetLanguageCode)) {
      return ctx.editReply(`### ⚠️ Invalid target language: ${targetCandidate}`);
    }
    const targetParam = targetCandidate as TargetLanguageCode;
    await ctx.context.get("db").setPreferredLanguage(userId, targetParam);
    return ctx.editReply(`### ✅ Preferred language set to **${AllLanguages[targetParam]} (${targetParam})**.`);
  });
