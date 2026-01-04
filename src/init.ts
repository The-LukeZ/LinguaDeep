import { createFactory } from "discord-hono";

export type HonoEnv = {
  Bindings: Env;
};

export const factory = createFactory<HonoEnv>();
