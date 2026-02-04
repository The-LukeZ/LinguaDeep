import { BaseHonocordEnv } from "honocord";
import { DBHelper } from "./utils";
import { Context } from "hono";

export type HonoVariables = { db: DBHelper };
export type HonoEnv = BaseHonocordEnv<Env, HonoVariables>;
export type MyContext = Context<{
  Bindings: Env;
  Variables: HonoVariables;
}>;
