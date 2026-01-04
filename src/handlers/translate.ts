import { SourceLanguageCode, TargetLanguageCode } from "deepl-node";
import { Command, Option } from "discord-hono";
import { factory } from "../init.js";
import {
  AllLanguages,
  Autocomplete,
  DBHelper,
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
      const text = (c.var.text || "").trim();
      if (!text) return c.followup("### ❌ Text to translate is required.");

      // Normalize and validate source language. If invalid or not provided, leave undefined -> DeepL will auto-detect.
      let sourceCandidate = (c.var.source_lang || c.interaction.user?.locale?.slice(0, 2)) as string | undefined;
      sourceCandidate = sourceCandidate?.trim();
      const sourceParam: SourceLanguageCode | undefined =
        sourceCandidate && SourceLanguages.includes(sourceCandidate as SourceLanguageCode)
          ? (sourceCandidate as SourceLanguageCode)
          : undefined;

      // Validate target language — must be a supported, non-empty code.
      const targetCandidate = (c.var.target_lang || "").trim();
      if (!targetCandidate) {
        return c.followup("### ❌ Target language is required. Please specify it using the `target_lang` option.");
      }
      if (!TargetLanguages.includes(targetCandidate as TargetLanguageCode)) {
        return c.followup(`### ❌ Invalid target language: ${targetCandidate}`);
      }
      const targetParam = targetCandidate as TargetLanguageCode;

      console.log("Using source language:", sourceParam ?? "auto-detect");
      console.log("Using target language:", targetParam);

      const userId = getUserIdFromInteraction(c.interaction);
      const userCfg = await c.get("db").getSetting(userId);
      if (!userCfg?.deeplApiKey) return c.followup("### ❌ DeepL API key not set. Please set it using `/key set` command.");

      const deepl = makeDeeplClient(userCfg);

      const result = await deepl.translateText(text, sourceParam || null, targetParam);
      return c.followup({
        embeds: [
          {
            title: "🌐 Translation Result",
            description: result.text,
            author: {
              name: `From ${AllLanguages[result.detectedSourceLang]} to ${AllLanguages[targetParam]}`,
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
