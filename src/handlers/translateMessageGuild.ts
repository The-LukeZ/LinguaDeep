import { ButtonBuilder, ContainerBuilder, inlineCode, StringSelectMenuBuilder, TextDisplayBuilder } from "@discordjs/builders";
import { SourceLanguageCode, TargetLanguageCode } from "deepl-node";
import { ApplicationCommandType, ApplicationIntegrationType, InteractionContextType } from "discord-api-types/v10";
import { Button, Command } from "discord-hono";
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

  const id: DurableObjectId = c.env.DATA_CACHE.idFromName(`${channelId}:${messageId}`);
  await c.env.DATA_CACHE.get(id).setData(`${channelId}:${messageId}`, text);

  return c.res({
    flags: V2EphemeralFlag,
    components: [
      new TextDisplayBuilder().setContent(inlineCode(message.id)).toJSON(),
      new ContainerBuilder()
        .setAccentColor(0x5865f2)
        .addTextDisplayComponents((t) => t.setContent("### Select target language:"))
        .addActionRowComponents<StringSelectMenuBuilder>((ar) => {
          const menus = targetLanguageChunks.map((chunk, index) =>
            new StringSelectMenuBuilder()
              .setCustomId(`translate_message_guild_target_${index}`)
              .setPlaceholder("Select target language")
              .addOptions(
                ...chunk.map((lang) => ({
                  label: AllLanguages[lang],
                  value: lang,
                })),
              ),
          );
          menus.forEach((menu) => ar.addComponents(menu));
          return ar;
        })
        .addSeparatorComponents((s) => s)
        .addTextDisplayComponents((t) => t.setContent("### (Optional) Select source language:"))
        .addActionRowComponents<StringSelectMenuBuilder>((ar) => {
          const menus = sourceLanguageChunks.map((chunk, index) =>
            new StringSelectMenuBuilder()
              .setCustomId(`translate_message_guild_source_${index}`)
              .setPlaceholder("Select source language (or leave empty for auto-detect)")
              .addOptions(
                ...chunk.map((lang) => ({
                  label: AllLanguages[lang],
                  value: lang,
                })),
              ),
          );
          menus.forEach((menu) => ar.addComponents(menu));
          return ar;
        })
        .addSeparatorComponents((s) => s.setSpacing(2))
        .addActionRowComponents((ar) =>
          ar.addComponents(
            new ButtonBuilder()
              .setCustomId(`translate_message_guild_confirm`)
              .setLabel("Translate Message")
              .setEmoji({
                name: "✅",
              })
              .setStyle(1),
          ),
        )
        .toJSON(),
    ],
  });
});

// Helper: find selected value within nested components
function findSelectedValueInComponents(comps: any[], prefix: string): string | undefined {
  for (const comp of comps) {
    if (comp.components) {
      const nested = findSelectedValueInComponents(comp.components, prefix);
      if (nested) return nested;
    }
    if (typeof comp.custom_id === "string" && comp.custom_id.startsWith(prefix)) {
      // Option list representations vary across contexts; check common shapes
      const options = comp.options ?? comp.props?.options ?? comp.data?.options;
      if (Array.isArray(options)) {
        const sel = options.find((o: any) => o.default === true || o.selected === true);
        if (sel) return sel.value;
      }
      if (Array.isArray(comp.values) && comp.values.length > 0) return comp.values[0];
      if (Array.isArray(comp.selected) && comp.selected.length > 0) return comp.selected[0];
    }
  }
  return undefined;
}

// Update helper: marks the selected option as default on the matching select menu and returns new components
function markSelectedInComponents(comps: any[], prefix: string, value: string): any[] {
  return comps.map((comp) => {
    if (comp.components) {
      return { ...comp, components: markSelectedInComponents(comp.components, prefix, value) };
    }
    if (typeof comp.custom_id === "string" && comp.custom_id.startsWith(prefix)) {
      const options = comp.options ?? comp.props?.options ?? comp.data?.options;
      if (Array.isArray(options)) {
        const newOptions = options.map((o: any) => ({ ...o, default: o.value === value }));
        // Preserve shape depending on where the options live
        if (comp.options) return { ...comp, options: newOptions };
        if (comp.props && comp.props.options) return { ...comp, props: { ...comp.props, options: newOptions } };
        if (comp.data && comp.data.options) return { ...comp, data: { ...comp.data, options: newOptions } };
      }
    }
    return comp;
  });
}

// Handler for target select menus - simply updates the message to reflect selection
export const componentTranslateMessageGuildTarget = factory.component(
  new Button("translate_message_guild_target_", "") as any,
  async (c: any) => {
    const values = c.interaction.data.values as string[] | undefined;
    if (!values || values.length === 0) return ackRequest();
    const val = values[0];

    const comps = c.interaction.message?.components ?? [];
    const updated = markSelectedInComponents(comps, "translate_message_guild_target_", val);
    return c.update().res({ components: updated } as any);
  },
);

// Handler for source select menus - updates the message to reflect selection (optional)
export const componentTranslateMessageGuildSource = factory.component(
  new Button("translate_message_guild_source_", "") as any,
  async (c: any) => {
    const values = c.interaction.data.values as string[] | undefined;
    if (!values) return ackRequest();
    const val = values[0];

    const comps = c.interaction.message?.components ?? [];
    const updated = markSelectedInComponents(comps, "translate_message_guild_source_", val);
    return c.update().res({ components: updated } as any);
  },
);

// Confirm button - parses the target/source languages from the stored message components
export const componentTranslateMessageGuild = factory.component(new Button("translate_message_guild_confirm", "") as any, async (c) => {
  // Parse chosen languages from the message components
  const comps = c.interaction.message?.components ?? [];
  const target = findSelectedValueInComponents(comps, "translate_message_guild_target_") as TargetLanguageCode | undefined;
  const source = findSelectedValueInComponents(comps, "translate_message_guild_source_") as SourceLanguageCode | undefined;

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
