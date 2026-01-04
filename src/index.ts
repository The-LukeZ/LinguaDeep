import { factory } from "./init";
import * as handlers from "./handlers/index.js";
import { verifyKey } from "./discordVerify";

export default factory.discord({ verify: verifyKey }).loader(Object.values(handlers));
