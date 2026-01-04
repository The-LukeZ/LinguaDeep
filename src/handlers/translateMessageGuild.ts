import { SourceLanguageCode, TargetLanguageCode } from "deepl-node";
import {
  APIMessageTopLevelComponent,
  ApplicationCommandType,
  ApplicationIntegrationType,
  ComponentType,
  InteractionContextType,
} from "discord-api-types/v10";
import { Button, Command, Content, Layout, Select } from "discord-hono";
import { factory } from "../init.js";
import {
  ackRequest,
  AllLanguages,
  buildTranstatedMessage,
  DBHelper,
  getUserIdFromInteraction,
  makeDeeplClient,
  SourceLanguages,
  TargetLanguages,
  V2EphemeralFlag,
} from "../utils.js";
import { inlineCode } from "@discordjs/formatters";

// A special command that only appears in guilds where the app is installed because otherwise we can't fetch a message to translate it.

const command = new Command("Translate Message")
  .type(ApplicationCommandType.Message)
  .integration_types(ApplicationIntegrationType.GuildInstall)
  .contexts(InteractionContextType.Guild);

// Chunks of 25 languages for select menu options
const targetLanguageChunks = TargetLanguages.reduce<TargetLanguageCode[][]>((chunks, lang) => {
  if (chunks.length === 0 || chunks[chunks.length - 1].length === 25) {
    chunks.push([]);
  }
  chunks[chunks.length - 1].push(lang);
  return chunks;
}, []);
const sourceLanguageChunks = SourceLanguages.reduce<SourceLanguageCode[][]>((chunks, lang) => {
  if (chunks.length === 0 || chunks[chunks.length - 1].length === 25) {
    chunks.push([]);
  }
  chunks[chunks.length - 1].push(lang);
  return chunks;
}, []);

export const componentTargetLanguageSelect = factory.component(new Select("translate_message_guild_target", "String"), async (c) => {
  if (c.interaction.data.component_type !== ComponentType.StringSelect) return ackRequest(); // Type guard

  const values = c.interaction.data.values;
  const val = values.length ? values[0] : undefined;
  const comps = c.interaction.message?.components ?? [];
  const updated = createLanguageSelectMessage(extractMessageIdFromComponents(comps), "translate_message_guild_target", val);
  return c.update().res(updated);
});

export const componentSourceLanguageSelect = factory.component(new Select("translate_message_guild_source", "String"), async (c) => {
  if (c.interaction.data.component_type !== ComponentType.StringSelect) return ackRequest(); // Type guard

  const values = c.interaction.data.values;
  const val = values.length ? values[0] : undefined;
  const comps = c.interaction.message?.components ?? [];
  const updated = createLanguageSelectMessage(extractMessageIdFromComponents(comps), val, "translate_message_guild_source");
  return c.update().res(updated);
});

export const componentClearTargetLanguage = factory.component(
  new Button("translate_message_guild_target_clear", ["❌", "Clear Target Language"], "Primary"),
  async (c) => {
    const comps = c.interaction.message?.components ?? [];
    const updated = createLanguageSelectMessage(extractMessageIdFromComponents(comps), undefined, "translate_message_guild_target");
    return c.update().res(updated);
  },
);

export const componentClearSourceLanguage = factory.component(
  new Button("translate_message_guild_source_clear", ["❌", "Clear Source Language"]),
  async (c) => {
    const comps = c.interaction.message?.components ?? [];
    const updated = createLanguageSelectMessage(extractMessageIdFromComponents(comps), undefined, "translate_message_guild_source");
    return c.update().res(updated);
  },
);

function extractMessageIdFromComponents(components: APIMessageTopLevelComponent[]): string {
  for (const comp of components) {
    if (comp.type === ComponentType.TextDisplay) {
      const content = (comp as any).text; // TextDisplay component
      const match = content.match(/`(\d{17,23})`/);
      if (match) {
        return match[1];
      }
    }
  }
  throw new Error("Message ID not found in components. This should not happen!");
}

function createLanguageSelectMessage(messageId: string, selectedSource?: string, selectedTarget?: string) {
  const comps = [new Content(inlineCode(messageId))] as any[];
  const container = new Layout("Container").accent_color(0x5865f2);
  const containerComps = [
    new Content("### Select target language:"),
    new Layout("Action Row").components(
      ...targetLanguageChunks.map((chunk, index) =>
        componentTargetLanguageSelect.component.custom_id(`translate_message_guild_target_${index}`).options(
          ...chunk.map((lang) => ({
            label: AllLanguages[lang],
            value: lang,
            default: !!(selectedTarget && selectedTarget === lang),
          })),
        ),
      ),
    ),
    new Layout("Separator"),
  ] as any[];

  if (selectedTarget) {
    containerComps.push(
      new Layout("Section")
        .components(new Content(`### Selected target language: **${AllLanguages[selectedTarget as TargetLanguageCode]}**`))
        .accessory(componentClearTargetLanguage.component),
    );
  } else {
    containerComps.push(
      new Content("### Select target language:"),
      new Layout("Action Row").components(
        ...targetLanguageChunks.map((chunk, index) =>
          componentTargetLanguageSelect.component
            .custom_id(`translate_message_guild_target_${index}`)
            .options(
              ...chunk.map((lang) => ({
                label: AllLanguages[lang],
                value: lang,
                default: !!(selectedTarget && selectedTarget === lang),
              })),
            )
            .toJSON(),
        ),
      ),
    );
  }
  containerComps.push(new Layout("Separator").spacing(2));

  if (selectedSource) {
    containerComps.push(
      new Layout("Section")
        .components(new Content(`### Selected source language: **${AllLanguages[selectedSource as SourceLanguageCode]}**`))
        .accessory(componentClearSourceLanguage.component),
    );
  } else {
    containerComps.push(
      new Content("### (Optional) Select source language:"),
      new Layout("Action Row").components(
        ...sourceLanguageChunks.map((chunk, index) =>
          componentSourceLanguageSelect.component
            .custom_id(`translate_message_guild_source_${index}`)
            .options(
              ...chunk.map((lang) => ({
                label: AllLanguages[lang],
                value: lang,
                default: !!(selectedSource && selectedSource === lang),
              })),
            )
            .toJSON(),
        ),
      ),
    );
  }

  containerComps.push(new Layout("Separator").spacing(2));
  containerComps.push(
    new Layout("Action Row").components(
      new Button("translate_message_guild_confirm", selectedTarget ? "Translate" : "Select a target language", "Success").disabled(
        !selectedTarget,
      ),
    ),
  );

  comps.push(container.components(...containerComps).toJSON());

  return {
    flags: V2EphemeralFlag,
    components: comps,
  };
}

function findSelectedValueInComponents<T>(components: APIMessageTopLevelComponent[], customIdPrefix: string): T | undefined {
  for (const comp of components) {
    if (comp.type === ComponentType.ActionRow) {
      for (const innerComp of comp.components) {
        if (innerComp.type === ComponentType.StringSelect && innerComp.custom_id.startsWith(customIdPrefix)) {
          const values = (innerComp as any).values as string[];
          console.log(`Found selected values for ${customIdPrefix}:`, values);
          if (values.length > 0) {
            return values[0] as T;
          }
        }
      }
    }
  }
}

// Confirm button - parses the target/source languages from the stored message components
export const componentTranslateMessageGuild = factory.component(new Button("translate_message_guild_confirm", ""), async (c) => {
  const comps = c.interaction.message?.components ?? [];

  const target = findSelectedValueInComponents(comps, "translate_message_guild_target") as TargetLanguageCode | undefined;
  const source = findSelectedValueInComponents(comps, "translate_message_guild_source") as SourceLanguageCode | undefined;
  return c.res(String(`Target: ${target}\nSource: ${source}`));

  if (!target) {
    return c.res({ flags: V2EphemeralFlag, content: "### ❌ Please select a target language before confirming." });
  }

  return c.flags("EPHEMERAL").resDefer(async (c) => {
    // Extract the message id from the inline code in the TextDisplay (we rendered it as `message.id`)
    const compStr = JSON.stringify(comps);
    const idMatch = compStr.match(/`(\d{17,23})`/);
    if (!idMatch) return c.res({ flags: V2EphemeralFlag, content: "### ❌ Could not read the selected message id." });
    const messageId = idMatch[1];
    const channelId = c.interaction.channel.id;

    // Retrieve the message text from the DataCache durable object (cached when the command was run)
    const key = `${channelId}:${messageId}`;
    const id: DurableObjectId = c.env.DATA_CACHE.idFromName(key);
    const stub = c.env.DATA_CACHE.get(id);
    const cachedText = await stub.getData(key);
    if (!cachedText) {
      return c.res({
        flags: V2EphemeralFlag,
        content:
          "### ⚠️ The cached message has expired.\nPlease run the **Translate Message** command on the message again to recreate the cache and try again.",
      });
    }

    const text = cachedText.trim();
    if (!text) return c.res({ flags: V2EphemeralFlag, content: "### ❌ The selected message has no content to translate." });

    // Translation setup
    c.set("db", new DBHelper(c.env.DB));
    const userId = getUserIdFromInteraction(c.interaction);
    const userCfg = await c.get("db").getSetting(userId);
    if (!userCfg?.deeplApiKey) {
      return c.res({ flags: V2EphemeralFlag, content: "### ❌ DeepL API key not set. Please set it using `/key set` command." });
    }

    const deepl = makeDeeplClient(userCfg);

    const sourceParam: SourceLanguageCode | null =
      source && SourceLanguages.includes(source as SourceLanguageCode) ? (source as SourceLanguageCode) : null;
    const targetParam = target as TargetLanguageCode;

    const result = await deepl.translateText(text, sourceParam || null, targetParam);

    // Reply with translated embed as a follow-up (ephemeral to the user)
    return c.followup(buildTranstatedMessage(result, targetParam));
  });
});

export const commandTranslateMessageGuild = factory.command(command, async (c) => {
  if (c.interaction.data.type !== ApplicationCommandType.Message) return ackRequest(); // Type guard

  const message = c.interaction.data.resolved.messages[c.interaction.data.target_id];
  const text = (message?.content || "").trim();
  if (!text) {
    return c.res({
      flags: V2EphemeralFlag,
      content: "### ❌ The selected message has no content to translate.",
    });
  }

  const channelId = c.interaction.channel.id;
  const messageId = message.id;

  return c.flags("EPHEMERAL").resDefer(async (c) => {
    const id: DurableObjectId = c.env.DATA_CACHE.idFromName(`${channelId}:${messageId}`);
    await c.env.DATA_CACHE.get(id).setData(`${channelId}:${messageId}`, text);

    try {
      const res = createLanguageSelectMessage(messageId);
      console.log("Created language select message:", res);
      return c.followup(res);
    } catch (err) {
      console.error("Error creating language select message:", err);
      return c.followup({
        flags: V2EphemeralFlag,
        content: "### ❌ An error occurred while creating the language selection menu. Please try again later.",
      });
    }
  });
});
