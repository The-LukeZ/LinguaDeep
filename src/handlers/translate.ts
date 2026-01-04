import { Command, Option } from "discord-hono";
import { factory } from "../init.js";
import { SourceLanguageCode, TargetLanguageCode } from "deepl-node";
import {
  AllLanguages,
  Autocomplete,
  DBHelper,
  EphemeralFlag,
  getUserIdFromInteraction,
  makeDeeplClient,
  SourceLanguages,
  TargetLanguages,
} from "../utils.js";

type Var = {
  text: string;
  target_lang?: TargetLanguageCode;
  source_lang?: SourceLanguageCode;
};

const command = new Command("translate", "Translate text using DeepL").options(
  new Option("text", "Text to translate", "String").required(true),
  new Option("target_lang", "Target language (e.g., en, de, fr) | Defaults to your client's language", "String")
    .required(false)
    .autocomplete(true),
  new Option("source_lang", "Source language (e.g., en, de, fr) | Auto-detected if not provided", "String").autocomplete(true),
);

export const autocomplete = factory.autocomplete<Var>(
  command,
  (c) => {
    if (!c.focused) return c.resAutocomplete({ choices: [{ name: "Nothing found...", value: "nothing" }] });
    if (c.focused.name !== "target_lang" && c.focused.name !== "source_lang") return new Response(null, { status: 204 }); // Gotta acknowledge the request anyways

    if (c.focused.name === "target_lang") {
      return c.resAutocomplete(
        new Autocomplete(c.focused.value as string)
          .choices(...TargetLanguages.map((code) => ({ name: AllLanguages[code], value: code })))
          .toJSON(),
      );
    }
    return c.resAutocomplete(
      new Autocomplete(c.focused.value as string)
        .choices(...SourceLanguages.map((code) => ({ name: AllLanguages[code], value: code })))
        .toJSON(),
    );
  },
  async (c) => {
    return c.flags("EPHEMERAL").resDefer(async (c) => {
      c.set("db", new DBHelper(c.env.DB));
      const text = c.var.text;
      const sourceLang = ((c.var.source_lang || c.interaction.user?.locale?.slice(0, 2)) as SourceLanguageCode) || undefined;
      const targetLang = c.var.target_lang;

      if (!targetLang) {
        return c.followup("### ❌ Target language is required. Please specify it using the `target_lang` option.");
      }

      const userId = getUserIdFromInteraction(c.interaction);
      const userCfg = await c.get("db").getSetting(userId);
      if (!userCfg?.deeplApiKey) return c.followup("### ❌ DeepL API key not set. Please set it using `/key set` command.");

      const deepl = makeDeeplClient(userCfg);

      const result = await deepl.translateText(text, sourceLang, targetLang);
      return c.followup({
        embeds: [
          {
            title: "🌐 Translation Result",
            description: result.text,
            author: {
              name: `From ${AllLanguages[result.detectedSourceLang]} to ${AllLanguages[targetLang]}`,
            },
            footer: {
              text: `Billed: ${result.billedCharacters} characters`,
            },
          },
        ],
      });
    });
  },
);
