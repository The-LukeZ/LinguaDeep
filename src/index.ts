import { DurableObject } from "cloudflare:workers";
import { verifyKey } from "./discordVerify";
import * as handlers from "./handlers/index.js";
import { factory } from "./init";
import { Hono } from "hono";

const discordApp = factory.discord({ verify: verifyKey }).loader(Object.values(handlers));

const app = new Hono<{ Bindings: Env }>();

// Mount it
app.mount("/interactions", discordApp.fetch);
app.all("/", (c) => c.redirect(`https://discord.com/discovery/applications/${c.env.DISCORD_APPLICATION_ID}`, 302));

export default app;

// Since the DO is a unique instance per message, we can "delete all" by just setting an alarm to clear the storage after a set time.
export class DataCache extends DurableObject {
  async getData(id: string): Promise<string | null> {
    const val = await this.ctx.storage.get<string>(id);
    if (!val) return null;
    return val;
  }

  async setData(key: string, value: string) {
    await this.ctx.storage.put(key, value);
    await this.ctx.storage.setAlarm(Date.now() + 3600_000); // 1 hour
    return;
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}
