import { factory } from "./init";
import * as handlers from "./handlers/index.js";

export default factory.discord().loader(Object.values(handlers));
