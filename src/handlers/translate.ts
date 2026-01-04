import { SourceLanguageCode, TargetLanguageCode } from "deepl-node";
import { Command, Option } from "discord-hono";
import { factory } from "../init.js";
import {
  ackRequest,
  AllLanguages,
  Autocomplete,
  buildTranstatedMessage,
  DBHelper,
  getPreferredTargetLanguage,
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

export const commandTranslate = factory.autocomplete<Var>(
  command,
  (c) => {
    if (!c.focused) return ackRequest();
    if (c.focused.name !== "target_lang" && c.focused.name !== "source_lang") return ackRequest(); // Gotta acknowledge the request anyways

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
      const userId = getUserIdFromInteraction(c.interaction);

      const text = (c.var.text || "").trim();
      if (!text) return c.followup("### ❌ Text to translate is required.");

      // Normalize and validate source language. If invalid or not provided, leave undefined -> DeepL will auto-detect.
      let sourceCandidate = (c.var.source_lang || c.interaction.user?.locale?.slice(0, 2)) as string | undefined;
      sourceCandidate = sourceCandidate?.trim();
      const sourceParam: SourceLanguageCode | undefined =
        sourceCandidate && SourceLanguages.includes(sourceCandidate as SourceLanguageCode)
          ? (sourceCandidate as SourceLanguageCode)
          : undefined;

      const targetCandidate =
        (c.var.target_lang || "").trim() || (await getPreferredTargetLanguage(c.get("db"), userId, c.interaction.locale));
      if (!TargetLanguages.includes(targetCandidate as TargetLanguageCode)) {
        return c.followup(`### ❌ Invalid target language: ${targetCandidate}`);
      }
      const targetParam = targetCandidate as TargetLanguageCode;

      console.log("Using source language:", sourceParam ?? "auto-detect");
      console.log("Using target language:", targetParam);

      const userCfg = await c.get("db").getSetting(userId);
      if (!userCfg?.deeplApiKey) return c.followup("### ❌ DeepL API key not set. Please set it using `/key set` command.");

      const deepl = makeDeeplClient(userCfg);

      const result = await deepl.translateText(text, sourceParam || null, targetParam);
      return c.followup(buildTranstatedMessage(result, targetParam));
    });
  },
);
