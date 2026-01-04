import { Command } from "discord-hono";
import { factory } from "../init.js";
import { SourceLanguageCode, TargetLanguageCode } from "deepl-node";
import { ApplicationCommandType, ApplicationIntegrationType, InteractionContextType } from "discord-api-types/v10";
import { ackRequest } from "../utils.js";

// A special command that only appears in guilds where the app is installed because otherwise we can't fetch a message to translate it.

const command = new Command("Translate Message", "Translate a message using DeepL")
  .type(ApplicationCommandType.Message)
  .integration_types(ApplicationIntegrationType.GuildInstall)
  .contexts(InteractionContextType.Guild);

export const commandTranslateMessageGuild = factory.command(command, async (c) => {
  if (c.interaction.data.type !== ApplicationCommandType.Message) return ackRequest(); // Type guard

  const message = c.interaction.data.resolved.messages[c.interaction.data.target_id];

  return c.res(`Translating message: "${message.content}"`);
});
