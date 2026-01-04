import { DurableObject } from "cloudflare:workers";
import { verifyKey } from "./discordVerify";
import * as handlers from "./handlers/index.js";
import { factory } from "./init";

const discordApp = factory.discord({ verify: verifyKey }).loader(Object.values(handlers));

export default discordApp;

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
