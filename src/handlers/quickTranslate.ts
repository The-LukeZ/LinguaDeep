import { ApplicationIntegrationType } from "discord-api-types/v10";
import { buildTranslatedMessage, errorResponse, getPreferredTargetLanguage, getUserIdFromInteraction, makeDeeplClient } from "../utils.js";
import { ContextCommandHandler, ContextCommandType } from "honocord";
import { MyContext } from "../types.js";

export const quickTrsCommand = new ContextCommandHandler<MyContext, ContextCommandType.Message>(ContextCommandType.Message)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
  .setName("Quick Translate")
  .addHandler(async (ctx) => {
    await ctx.deferReply(true);

    const text = (ctx.targetMessage.content || "").trim();
    if (!text) return ctx.editReply(errorResponse("The selected message has no content to translate."));

    const userId = getUserIdFromInteraction(ctx);
    const userCfg = await ctx.context.get("db").getSetting(userId);
    if (!userCfg?.deeplApiKey) return ctx.editReply(errorResponse("DeepL API key not set. Please set it using `/key set` command."));

    const targetLang = await getPreferredTargetLanguage(userCfg, ctx.locale || "en");

    const deepl = makeDeeplClient(userCfg);

    const result = await deepl.translateText(text, null, targetLang);
    return ctx.editReply(buildTranslatedMessage(result, targetLang));
  });
