import { Command } from "discord-hono";
import { factory } from "../init.js";
import {
  ackRequest,
  buildTranstatedMessage,
  DBHelper,
  errorResponse,
  getPreferredTargetLanguage,
  getUserIdFromInteraction,
  makeDeeplClient,
} from "../utils.js";
import { ApplicationCommandType, ApplicationIntegrationType } from "discord-api-types/v10";

const command = new Command("Translate")
  .type(ApplicationCommandType.Message)
  .integration_types(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall);

export const commandTranslateMessage = factory.command(command, async (c) => {
  if (c.interaction.data.type !== ApplicationCommandType.Message) return ackRequest(); // Type guard

  const message = c.interaction.data.resolved.messages[c.interaction.data.target_id];

  return c.flags("EPHEMERAL").resDefer(async (c) => {
    const text = (message?.content || "").trim();
    if (!text) return c.followup(errorResponse("The selected message has no content to translate."));

    c.set("db", new DBHelper(c.env.DB));

    const userId = getUserIdFromInteraction(c.interaction);
    const userCfg = await c.get("db").getSetting(userId);
    if (!userCfg?.deeplApiKey) return c.followup(errorResponse("DeepL API key not set. Please set it using `/key set` command."));

    const targetLang = await getPreferredTargetLanguage(userCfg, c.interaction.locale);
    console.log("Translating message text to:", userCfg.preferredLanguage, targetLang);

    const deepl = makeDeeplClient(userCfg);

    const result = await deepl.translateText(text, null, targetLang);
    return c.followup(buildTranstatedMessage(result, targetLang));
  });
});
