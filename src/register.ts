// This file supposed to be run by the `register` script in package.json (runs with tsx)

import { register } from "discord-hono";
import * as handlers from "./handlers/index.js";
import { factory } from "./init.js";

register(
  factory.getCommands(Object.values(handlers)),
  process.env.DISCORD_APPLICATION_ID,
  process.env.DISCORD_TOKEN,
  //process.env.DISCORD_TEST_GUILD_ID,
);
