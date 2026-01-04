import { TargetLanguageCode } from "deepl-node";
import { ApplicationIntegrationType } from "discord-api-types/v10";
import { Command, Option, SubCommand } from "discord-hono";
import { factory } from "../init.js";
import { ackRequest, AllLanguages, Autocomplete, DBHelper, errorResponse, getUserIdFromInteraction, TargetLanguages } from "../utils.js";

type Var = {
  language: TargetLanguageCode;
};

const command = new Command("preferred-language", "Set your preferred target language for translations")
  .options(
    new SubCommand("set", "Set your preferred target language").options(
      new Option("language", "Preferred target language (e.g., en, de, fr)", "String")
        .required(true)
        .autocomplete(true)
        .min_length(2)
        .max_length(7),
    ),
    new SubCommand("clear", "Clear your preferred target language"),
  )
  .integration_types(ApplicationIntegrationType.UserInstall);

export const commandPreferredLanguage = factory.autocomplete<Var>(
  command,
  (c) => {
    if (!c.focused) return ackRequest();
    if (c.focused.name !== "language") return ackRequest(); // Gotta acknowledge the request anyways
    return c.resAutocomplete(
      new Autocomplete(c.focused.value as string)
        .choices(...TargetLanguages.map((code) => ({ name: AllLanguages[code], value: code })))
        .toJSON(),
    );
  },
  async (c) => {
    return c.flags("EPHEMERAL").resDefer(async (c) => {
      c.set("db", new DBHelper(c.env.DB));
      const userId = getUserIdFromInteraction(c.interaction);

      if (c.sub.string === "clear") {
        const userCfg = await c.get("db").getSetting(userId);
        if (!userCfg?.deeplApiKey) {
          await c.get("db").removeSettings(userId);
        }
        await c.get("db").setPreferredLanguage(userId, null);
        return c.followup("### ✅ Preferred language cleared. Translations will now use your client's language.");
      }

      // Validate target language — must be a supported, non-empty code.
      const targetCandidate = (c.var.language || "").trim();
      if (!targetCandidate) {
        return c.followup(errorResponse("Language is required. Please specify it using the `language` option."));
      }
      if (!TargetLanguages.includes(targetCandidate as TargetLanguageCode)) {
        return c.followup(errorResponse(`Invalid target language: ${targetCandidate}`));
      }
      const targetParam = targetCandidate as TargetLanguageCode;

      await c.get("db").setPreferredLanguage(userId, targetParam);
      return c.followup(`### ✅ Preferred language set to **${AllLanguages[targetParam]} (${targetParam})**.`);
    });
  },
);
