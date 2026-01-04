import { Command, Option } from "discord-hono";
import { factory } from "../init.js";
import { SourceLanguageCode, TargetLanguageCode } from "deepl-node";
import { ackRequest, AllLanguages, SourceLanguages, TargetLanguages } from "../utils.js";
import { ApplicationCommandType } from "discord-api-types/v10";

type Var = {
  text: string;
  target_lang?: TargetLanguageCode;
  source_lang?: SourceLanguageCode;
};

const command = new Command("Translate to Client Language", "Translate a message using DeepL").type(ApplicationCommandType.Message);

export const commandTranslateMessage = factory.command(command, async (c) => {
  if (c.interaction.data.type !== ApplicationCommandType.Message) return ackRequest(); // Type guard

  const message = c.interaction.data.resolved.messages[c.interaction.data.target_id];

  return c.res(`Translating message: "${message.content}"`);
});
