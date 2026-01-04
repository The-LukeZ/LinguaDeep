import { SourceLanguageCode, TargetLanguageCode } from "deepl-node";
import { ApplicationCommandType, ApplicationIntegrationType, ComponentType, InteractionContextType } from "discord-api-types/v10";
import { Button, Command, Content, Layout, Select } from "discord-hono";
import { factory } from "../init.js";
import {
  ackRequest,
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

// A special command that only appears in guilds where the app is installed because otherwise we can't fetch a message to translate it.

const command = new Command("Translate (Choose Language)")
  .type(ApplicationCommandType.Message)
  .integration_types(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall);

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
  const parsed = JSON.parse(customId) as [string, string | undefined, number | undefined];
  return {
    messageId: parsed[0],
    sourceOrTarget: parsed[1],
    chunkIndex: parsed[2],
  };
}

export const componentTargetLanguageSelect = factory.component(
  new Select("translate_message_guild_target", "String").placeholder("Select a target language"),
  async (c) => {
    if (c.interaction.data.component_type !== ComponentType.StringSelect) return ackRequest(); // Type guard

    const values = c.interaction.data.values;
    const val = values.length ? values[0] : undefined;
    const data = extractDataFromSelectCustomId(c.var.custom_id!);
    const updated = createLanguageSelectMessage(data.messageId, data.sourceOrTarget, val);
    return c.update().res(updated);
  },
);

export const componentSourceLanguageSelect = factory.component(
  new Select("translate_message_guild_source", "String").placeholder("Select a source language"),
  async (c) => {
    if (c.interaction.data.component_type !== ComponentType.StringSelect) return ackRequest(); // Type guard

    const values = c.interaction.data.values;
    const val = values.length ? values[0] : undefined;
    const data = extractDataFromSelectCustomId(c.var.custom_id!);
    const updated = createLanguageSelectMessage(data.messageId, val, data.sourceOrTarget);
    return c.update().res(updated);
  },
);

export const componentClearTargetLanguage = factory.component(
  new Button("translate_message_guild_target_clear", ["❌", "Clear Target Language"], "Secondary"),
  async (c) => {
    const data = extractDataFromSelectCustomId(c.var.custom_id!);
    const updated = createLanguageSelectMessage(data.messageId, data.sourceOrTarget, undefined);
    return c.update().res(updated);
  },
);

export const componentClearSourceLanguage = factory.component(
  new Button("translate_message_guild_source_clear", ["❌", "Clear Source Language"], "Secondary"),
  async (c) => {
    const data = extractDataFromSelectCustomId(c.var.custom_id!);
    const updated = createLanguageSelectMessage(data.messageId, undefined, data.sourceOrTarget);
    return c.update().res(updated);
  },
);

function createLanguageSelectMessage(messageId: string, selectedSource?: string, selectedTarget?: string) {
  const container = new Layout("Container").accent_color(0x5865f2);
  const containerComps = [] as any[];

  if (selectedTarget) {
    containerComps.push(
      new Layout("Section")
        .components(new Content(`### Selected target language: **${AllLanguages[selectedTarget as TargetLanguageCode]}**`))
        .accessory(componentClearTargetLanguage.component.custom_id(JSON.stringify([messageId, selectedSource])).toJSON()),
    );
  } else {
    containerComps.push(
      new Content("### Select target language:"),
      ...targetLanguageChunks.map((chunk, index) => ({
        type: 1,
        components: [
          componentTargetLanguageSelect.component
            .custom_id(JSON.stringify([messageId, selectedSource, index]))
            .options(
              ...chunk.map((lang) => ({
                label: AllLanguages[lang],
                value: lang,
                default: !!(selectedTarget && selectedTarget === lang),
              })),
            )
            .toJSON(),
        ],
      })),
    );
  }
  containerComps.push(new Layout("Separator").divider(true));

  if (selectedSource) {
    containerComps.push(
      new Layout("Section")
        .components(new Content(`### Selected source language: **${AllLanguages[selectedSource as SourceLanguageCode]}**`))
        .accessory(componentClearSourceLanguage.component.custom_id(JSON.stringify([messageId, selectedTarget])).toJSON()),
    );
  } else {
    containerComps.push(
      new Content("### (Optional) Select source language:"),
      ...sourceLanguageChunks.map((chunk, index) => ({
        type: 1,
        components: [
          componentSourceLanguageSelect.component
            .custom_id(JSON.stringify([messageId, selectedTarget, index]))
            .options(
              ...chunk.map((lang) => ({
                label: AllLanguages[lang],
                value: lang,
                default: !!(selectedSource && selectedSource === lang),
              })),
            )
            .toJSON(),
        ],
      })),
    );
  }

  containerComps.push(new Layout("Separator").spacing(2).divider(false));
  containerComps.push({
    type: 1,
    components: [
      new Button("translate_message_confirm", selectedTarget ? "Translate" : "Select a target language", "Success")
        .disabled(!selectedTarget)
        .custom_id([messageId, selectedTarget, selectedSource].filter(Boolean).join("/"))
        .toJSON(),
    ],
  });

  const comps = [container.components(...containerComps).toJSON()];

  return {
    flags: V2Flag,
    components: comps,
  };
}

// Confirm button - replies with ephemeral message, then edits it
export const componentTranslateMessageConfirm = factory.component(new Button("translate_message_confirm", ""), async (c) => {
  const channelId = c.interaction.channel.id;
  const [messageId, target, source] = c.var.custom_id!.split("/");

  if (!target) {
    return c.res(errorResponse("Please select a target language before confirming."));
  }

  // Reply with initial ephemeral message
  return c.flags("IS_COMPONENTS_V2", "EPHEMERAL").res({
    content: "🔄 Translating message...",
  }, async (c) => {
    // Now edit the reply with the translation result
    try {
      // Retrieve the message text from the DataCache durable object (cached when the command was run)
      const key = `${channelId}:${messageId}`;
      const id: DurableObjectId = c.env.DATA_CACHE.idFromName(key);
      const stub = c.env.DATA_CACHE.get(id);
      const cachedText = await stub.getData(key);
      
      if (!cachedText) {
        return c.followup(
          errorResponse(
            "⚠️ The cached message has expired.\nPlease run the **Translate Message** command on the message again to recreate the cache and try again.",
            false,
          ),
        );
      }

      const text = cachedText.trim();
      if (!text) {
        return c.followup(errorResponse("The selected message has no content to translate."));
      }

      // Translation setup
      c.set("db", new DBHelper(c.env.DB));
      const userId = getUserIdFromInteraction(c.interaction);
      const userCfg = await c.get("db").getSetting(userId);
      
      if (!userCfg?.deeplApiKey) {
        return c.followup(errorResponse("DeepL API key not set. Please set it using `/key set` command."));
      }

      const deepl = makeDeeplClient(userCfg);

      const sourceParam: SourceLanguageCode | null =
        source && SourceLanguages.includes(source as SourceLanguageCode) ? (source as SourceLanguageCode) : null;
      const targetParam = target as TargetLanguageCode;

      const result = await deepl.translateText(text, sourceParam || null, targetParam);

      // Edit the initial reply with the translated message
      return c.followup(buildTranslatedMessage(result, targetParam));
    } catch (err) {
      console.error("Translation error:", err);
      return c.followup(errorResponse("An error occurred during translation. Please try again later."));
    }
  });
});

export const commandTranslateMessageGuild = factory.command(command, (c) =>
  c.flags("EPHEMERAL", "IS_COMPONENTS_V2").resDefer(async (c) => {
    if (c.interaction.data.type !== ApplicationCommandType.Message) return ackRequest(); // Type guard
    const message = c.interaction.data.resolved.messages[c.interaction.data.target_id];
    const text = (message?.content || "").trim();
    if (!text) {
      return c.followup(errorResponse("The selected message has no content to translate."));
    }

    const channelId = c.interaction.channel.id;
    const messageId = message.id;

    const id: DurableObjectId = c.env.DATA_CACHE.idFromName(`${channelId}:${messageId}`);
    await c.env.DATA_CACHE.get(id).setData(`${channelId}:${messageId}`, text);

    try {
      const res = createLanguageSelectMessage(messageId);
      await c.followup(res).then(() => console.log("Language select message sent."));
    } catch (err) {
      console.error("Error creating language select message:", err);
      await c.followup(errorResponse("An error occurred while preparing the language selection. Please try again later."));
    }
  }),
);
