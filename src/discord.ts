import { API } from "@discordjs/core/http-only";
import { REST } from "@discordjs/rest";

const rest = new REST({
  version: "10",
}).setToken(process.env.DISCORD_TOKEN);

export const api = new API(rest);
