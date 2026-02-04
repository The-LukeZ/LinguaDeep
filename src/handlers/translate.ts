import { SourceLanguageCode, TargetLanguageCode } from "deepl-node";
import {
  ackRequest,
  AllLanguages,
  Autocomplete,
  buildTranslatedMessage,
  DBHelper,
  errorResponse,
  getPreferredTargetLanguage,
  getUserIdFromInteraction,
  makeDeeplClient,
  SourceLanguages,
  TargetLanguages,
} from "../utils.js";
import { SlashCommandHandler } from "honocord";
import { MyContext } from "../types.js";

type Var = {
  text: string;
  target_lang?: TargetLanguageCode;
  source_lang?: SourceLanguageCode;
};

// const command = new Command("translate", "Translate text using DeepL").options(
//   new Option("text", "Text to translate", "String").required(true),
//   new Option("target_lang", "Target language (e.g., en, de, fr) | Defaults to your client's language", "String")
//     .required(false)
//     .autocomplete(true),
//   new Option("source_lang", "Source language (e.g., en, de, fr) | Auto-detected if not provided", "String").autocomplete(true),
// );

export const trsCommand = new SlashCommandHandler<MyContext>()
  .setName("translate")
  .setDescription("Translate text using DeepL")
  .addStringOption((option) => option.setName("text").setDescription("Text to translate").setRequired(true))
  .addStringOption((option) =>
    option
      .setName("target_lang")
      .setDescription("Target language (e.g., en, de, fr) | Defaults to your client's language")
      .setRequired(false)
      .setAutocomplete(true),
  )
  .addStringOption((option) =>
    option
      .setName("source_lang")
      .setDescription("Source language (e.g., en, de, fr) | Auto-detected if not provided")
      .setRequired(false)
      .setAutocomplete(true),
  )
  .addAutocompleteHandler(async (ctx) => {
    const option = ctx.options.getFocused();
    if (!option || (option.name !== "target_lang" && option.name !== "source_lang")) return ackRequest();

    if (option.name === "target_lang") {
      return ctx.respond(
        new Autocomplete(option.value).choices(...TargetLanguages.map((code) => ({ name: AllLanguages[code], value: code }))).toJSON(),
      );
    }
    return ctx.respond(
      new Autocomplete(option.value).choices(...SourceLanguages.map((code) => ({ name: AllLanguages[code], value: code }))).toJSON(),
    );
  })
  .addHandler(async (ctx) => {
    await ctx.deferReply(true);
    const userId = getUserIdFromInteraction(ctx);

    const text = ctx.options.getString("text", true).trim();
    if (!text) return ctx.editReply(errorResponse("Text to translate is required."));

    // Normalize and validate source language. If invalid or not provided, leave undefined -> DeepL will auto-detect.
    let sourceCandidate = (ctx.options.getString("source_lang") || ctx.user.locale?.slice(0, 2)) as string | undefined;
    sourceCandidate = sourceCandidate?.trim();
    const sourceParam: SourceLanguageCode | undefined =
      sourceCandidate && SourceLanguages.includes(sourceCandidate as SourceLanguageCode)
        ? (sourceCandidate as SourceLanguageCode)
        : undefined;

    const userCfg = await ctx.context.get("db").getSetting(userId);
    const targetCandidate =
      (ctx.options.getString("target_lang") || "").trim() || (await getPreferredTargetLanguage(userCfg, ctx.user.locale || "en"));
    if (!TargetLanguages.includes(targetCandidate as TargetLanguageCode)) {
      return ctx.editReply(errorResponse(`Invalid target language: ${targetCandidate}`));
    }
    const targetParam = targetCandidate as TargetLanguageCode;

    if (!userCfg?.deeplApiKey) return ctx.editReply(errorResponse("DeepL API key not set. Please set it using `/key set` command."));

    const deepl = makeDeeplClient(userCfg);

    const result = await deepl.translateText(text, sourceParam || null, targetParam);
    return ctx.editReply(buildTranslatedMessage(result, targetParam));
  });
