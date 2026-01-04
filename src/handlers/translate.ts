import { Command, Option } from "discord-hono";
import { factory } from "../init.js";
import { SourceLanguageCode, TargetLanguageCode } from "deepl-node";
import { AllLanguages, SourceLanguages, TargetLanguages } from "../utils.js";

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
    if (c.focused.name === "text") return new Response(null, { status: 204 }); // Gotta acknowledge the request anyways
    if (c.focused.name === "target_lang") {
      return c.resAutocomplete({ choices: TargetLanguages.map((code) => ({ name: AllLanguages[code], value: code })) });
    }
    return c.resAutocomplete({ choices: SourceLanguages.map((code) => ({ name: AllLanguages[code], value: code })) });
  },
  async (c) => {
    const text = c.var.text;
    const sourceLang = (c.var.source_lang as SourceLanguageCode) || c.interaction.user?.locale || undefined;
    const targetLang = c.var.target_lang as TargetLanguageCode;

    return c.res(`Translating "${text}" from ${sourceLang || "auto-detected"} to ${targetLang || "client's language..."}`);
  },
);
