import { Autocomplete, DiscordHono } from "discord-hono";

const app = new DiscordHono<Env>();

app.command("help", (c) =>
  c.res(
    "- Use `/translate` to translate text using DeepL API.\n" +
      "- Configure your settings with `/settings`.\n\n" +
      "This bot is a BYOK (Bring Your Own Key) application, so make sure to set your DeepL API key in the settings.",
  ),
);

app.autocomplete("translate", (c) => {
  if (!c.focused) return c.resAutocomplete({ choices: [{ name: "Nothing found...", value: "nothing" }] });
  if (c.focused.name === "text") return c.env

  return c.resAutocomplete({ choices: [] });
});

export default app;
