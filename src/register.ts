import { registerCommands } from "honocord";
import * as handlers from "./handlers/index";

await registerCommands(process.env.DISCORD_TOKEN!, process.env.DISCORD_APPLICATION_ID!, Object.values(handlers));
