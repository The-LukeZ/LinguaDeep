import { SourceLanguageCode, TargetLanguageCode } from "deepl-node";
import { ApplicationIntegrationType } from "discord-api-types/v10";
import {
  AllLanguages,
  buildTranslatedMessage,
  DBHelper,
  errorResponse,
  getUserIdFromInteraction,
  makeDeeplClient,
  SourceLanguages,
  TargetLanguages,
  V2Flag,
} from "../utils.js";
import {
  ComponentHandler,
  ContextCommandHandler,
  ContextCommandType,
  ComponentType,
  ContainerBuilder,
  ButtonBuilder,
  parseCustomId,
  StringSelectMenuBuilder,
  ActionRowBuilder,
} from "honocord";
import { MyContext } from "../types.js";

export const trsMsgCommand = new ContextCommandHandler<MyContext, ContextCommandType.Message>(ContextCommandType.Message)
  .setName("Translate (Choose Language)")
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall);

// Chunks of 25 languages for select menu options
const targetLanguageChunks = TargetLanguages.sort().reduce<TargetLanguageCode[][]>((chunks, lang) => {
  if (chunks.length === 0 || chunks[chunks.length - 1].length === 25) {
    chunks.push([]);
  }
  chunks[chunks.length - 1].push(lang);
  return chunks;
}, []);
const sourceLanguageChunks = SourceLanguages.sort().reduce<SourceLanguageCode[][]>((chunks, lang) => {
  if (chunks.length === 0 || chunks[chunks.length - 1].length === 25) {
    chunks.push([]);
  }
  chunks[chunks.length - 1].push(lang);
  return chunks;
}, []);

function extractDataFromSelectCustomId(customId: string) {
  const { compPath, firstParam } = parseCustomId(customId) as { compPath: string[]; firstParam?: string };
  return {
    messageId: compPath[1],
    sourceOrTarget: compPath[2],
    chunkIndex: firstParam ? parseInt(firstParam, 10) : 0,
  };
}

export const targetLSelect = new ComponentHandler<MyContext, ComponentType.StringSelect>(
  "messageGuildTarget",
  ComponentType.StringSelect,
).addHandler(async (ctx) => {
  const val = ctx.values[0];
  const data = extractDataFromSelectCustomId(ctx.customId);
  const updated = createLanguageSelectMessage(data.messageId, data.sourceOrTarget, val);
  await ctx.update(updated);
});

export const sourceLSelect = new ComponentHandler<MyContext, ComponentType.StringSelect>(
  "messageGuildSource",
  ComponentType.StringSelect,
).addHandler(async (ctx) => {
  const val = ctx.values[0];
  const data = extractDataFromSelectCustomId(ctx.customId);
  const updated = createLanguageSelectMessage(data.messageId, val, data.sourceOrTarget);
  await ctx.update(updated);
});

export const componentClearTargetLanguage = new ComponentHandler<MyContext, ComponentType.Button>(
  "messageGuildTargetClear",
  ComponentType.Button,
).addHandler(async (ctx) => {
  const data = extractDataFromSelectCustomId(ctx.customId);
  const updated = createLanguageSelectMessage(data.messageId, data.sourceOrTarget, undefined);
  await ctx.update(updated);
});

export const componentClearSourceLanguage = new ComponentHandler<MyContext, ComponentType.Button>(
  "messageGuildSourceClear",
  ComponentType.Button,
).addHandler(async (ctx) => {
  const data = extractDataFromSelectCustomId(ctx.customId);
  const updated = createLanguageSelectMessage(data.messageId, undefined, data.sourceOrTarget);
  await ctx.update(updated);
});

function createLanguageSelectMessage(messageId: string, selectedSource?: string, selectedTarget?: string) {
  const container = new ContainerBuilder().setAccentColor(0x5865f2);

  if (selectedTarget) {
    container.addSectionComponents((sec) =>
      sec
        .addTextDisplayComponents((t) =>
          t.setContent(`### Selected target language: **${AllLanguages[selectedTarget as TargetLanguageCode]}**`),
        )
        .setButtonAccessory(new ButtonBuilder().setCustomId(`asd?${messageId}/${selectedSource}`)),
    );
  } else {
    container
      .addTextDisplayComponents((t) => t.setContent("### Select target language:"))
      .addActionRowComponents(
        ...targetLanguageChunks.map((chunk, index) =>
          new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
            new StringSelectMenuBuilder().setCustomId(`messageGuildTarget/${messageId}/${selectedSource}?${index}`).setOptions(
              ...chunk.map((lang) => ({
                label: AllLanguages[lang],
                value: lang,
                default: !!(selectedTarget && selectedTarget === lang),
              })),
            ),
          ),
        ),
      );
  }
  container.addSeparatorComponents((s) => s);

  if (selectedSource) {
    container.addSectionComponents((sec) =>
      sec
        .addTextDisplayComponents((t) =>
          t.setContent(`### Selected source language: **${AllLanguages[selectedSource as SourceLanguageCode]}**`),
        )
        .setButtonAccessory(new ButtonBuilder().setCustomId(`messageGuildSourceClear/${messageId}/${selectedTarget}`)),
    );
  } else {
    container
      .addTextDisplayComponents((t) => t.setContent("### (Optional) Select source language:"))
      .addActionRowComponents(
        ...sourceLanguageChunks.map((chunk, index) =>
          new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
            new StringSelectMenuBuilder().setCustomId(`messageGuildSource/${messageId}/${selectedTarget}?${index}`).setOptions(
              ...chunk.map((lang) => ({
                label: AllLanguages[lang],
                value: lang,
                default: !!(selectedSource && selectedSource === lang),
              })),
            ),
          ),
        ),
      );
  }

  container.addSeparatorComponents((s) => s);
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().setComponents(
      new ButtonBuilder()
        .setLabel(selectedTarget ? "Translate" : "Select a target language")
        .setStyle(3)
        .setDisabled(!selectedTarget)
        .setCustomId(`translate_message_confirm/${messageId}/${selectedTarget || ""}/${selectedSource || ""}`),
    ),
  );

  return {
    flags: V2Flag,
    components: [container],
  };
}

export const componentTrsMessageConfirm = new ComponentHandler<MyContext, ComponentType.Button>(
  "translate_message_confirm",
  ComponentType.Button,
).addHandler(async (ctx) => {
  const channelId = ctx.channel!.id;
  const [messageId, target, source] = ctx.customId.split("/");

  if (!target) {
    return ctx.reply(errorResponse("Please select a target language before confirming."));
  }

  await ctx.deferReply(true);

  // Retrieve the message text from the DataCache durable object (cached when the command was run)
  const key = `${channelId}:${messageId}`;
  const id: DurableObjectId = ctx.context.env.DATA_CACHE.idFromName(key);
  const stub = ctx.context.env.DATA_CACHE.get(id);
  const cachedText = await stub.getData(key);

  if (!cachedText) {
    return ctx.editReply(
      errorResponse(
        "⚠️ The cached message has expired.\nPlease run the **Translate Message** command on the message again to recreate the cache and try again.",
        false,
      ),
    );
  }

  const text = cachedText.trim();
  if (!text) return ctx.editReply(errorResponse("The selected message has no content to translate."));

  const db = new DBHelper(ctx.context.env.DB);
  const userId = getUserIdFromInteraction(ctx);
  const userCfg = await db.getSetting(userId);

  if (!userCfg?.deeplApiKey) {
    return ctx.editReply(errorResponse("DeepL API key not set. Please set it using `/key set` command."));
  }

  const deepl = makeDeeplClient(userCfg);

  const sourceParam: SourceLanguageCode | null =
    source && SourceLanguages.includes(source as SourceLanguageCode) ? (source as SourceLanguageCode) : null;
  const targetParam = target as TargetLanguageCode;

  const result = await deepl.translateText(text, sourceParam || null, targetParam);

  return ctx.editReply(buildTranslatedMessage(result, targetParam));
});

export const trsMessageCommand = new ContextCommandHandler<MyContext, ContextCommandType.Message>(ContextCommandType.Message)
  .setName("Translate (Choose Language)")
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
  .addHandler(async (ctx) => {
    if (!ctx.channel) {
      return ctx.reply(errorResponse("This command can only be used in a guild channel."));
    }
    const channelId = ctx.channel.id;
    const messageId = ctx.targetMessage.id;
    const text = (ctx.targetMessage.content || "").trim();
    if (!text) {
      return ctx.editReply(errorResponse("The selected message has no content to translate."));
    }

    const key = `${channelId}:${messageId}`;
    const id: DurableObjectId = ctx.context.env.DATA_CACHE.idFromName(key);
    const stub = ctx.context.env.DATA_CACHE.get(id);
    await stub.setData(key, text);

    try {
      const res = createLanguageSelectMessage(messageId);
      await ctx.editReply(res);
    } catch (err) {
      console.error("Error creating language select message:", err);
      await ctx.editReply(errorResponse("An error occurred while preparing the language selection. Please try again later."));
    }
  });
