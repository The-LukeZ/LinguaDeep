import { createFactory } from "discord-hono";
import type { DBHelper } from "./utils";

export type HonoEnv = {
  Bindings: Env;
  Variables: {
    db: DBHelper;
  };
};

export const factory = createFactory<HonoEnv>();
