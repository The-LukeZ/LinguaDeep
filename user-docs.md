# LinguaDeep Discord Bot User Wiki

## Command Overview 🛠️

- **`/translate`** — Translate arbitrary text
  - Options:
    - `text` (required): Text to translate
    - `target_lang` (optional): Target language code (autocomplete available; defaults to your preferred language or client locale)
    - `source_lang` (optional): Source language code (if omitted, DeepL will auto-detect)
  - Example: `/translate text:"Hello world" target_lang:"de"`

- **`/preferred-language`** — Set or clear your preferred target language
  - Subcommands:
    - `set language:<code>` — Set a default target language
    - `clear` — Remove your preferred language (falls back to your client locale)
  - Example: `/preferred-language set language:"fr"`

- **`/key`** — Manage your DeepL API key (required to use translations)
  - Subcommands:
    - `set api_key:<key> deepl_version:<Free|Pro>` — Store your DeepL key (encrypted)
    - `remove` — Remove your stored key
    - `view` — View masked key info and usage stats from DeepL
  - Important: This bot is BYOK — translations consume characters on **your** DeepL plan.

- **Message actions (context menu)** — Translate specific messages
  - `Quick Translate` (Message) — Translate the chosen message using your set preferred language or client language (ephemeral).
  - `Translate (Choose Language)` — Opens an interactive language selector to pick target (and optionally source) languages before confirming the translation.

- **`/help`** — Short usage summary and next steps (also explains BYOK)

---

## How to Use — Step-by-step 💡

1. [Get a DeepL API key (Free or Pro) from DeepL.](https://www.deepl.com/your-account/keys)
2. Set it in the bot:
   - `/key set api_key:"YOUR_KEY" deepl_version:Free` (or `Pro`)
   - It is encrypted and stored in the bot's database.
3. Optionally set your default target language:
   - `/preferred-language set language:"en-US"`
4. Translate:
   - Quick text: `/translate text:"Hola" target_lang:"en-US"`
   - Message: right-click a message → Apps → `Quick Translate` (ephemeral to you).
   - In guilds, use `Translate (Choose Language)` for a language selector with confirmation.

---

## Language codes & tips 🔤

- Autocomplete is available when you type a language option.
- Some common target codes:
  - English (US): `en-US` | English (GB): `en-GB`
  - Spanish: `es`, German: `de`, French: `fr`
  - Portuguese: `pt-BR`, `pt-PT`
  - Chinese (simplified): `zh-HANS`, (traditional): `zh-HANT`
- If `source_lang` is omitted, DeepL will auto-detect the source language.

---

## What to expect (behavior & UI) ⚙️

- Responses are **all ephemeral** (visible only to the executor).
- Translations show an embed with the detected source language, the translated text, and billed character count.
- `/key view` shows usage and whether you've hit any DeepL plan limits.

---

## Restrictions & Important Notes ⚠️

- **You must provide your own DeepL API key** — without it, the bot cannot translate: it will reply "DeepL API key not set. Please set it using `/key set`".
- Character usage and billing are handled by **your DeepL account**. Check `/key view` for usage details.
- Language selection in `Translate Message` uses a short-lived cache for message text; if the cache expires you’ll be asked to run the command again.
- Max 25 autocomplete choices (Discord limitation); selection menus are chunked when necessary.
- The bot uses DeepL limits and may return errors if your plan's limit has been reached.

---

## Troubleshooting & FAQ ❓

- Q: "Translation failed / nothing happened."
  - A: Check you set your key with `/key set` and run `/key view` to see usage. If your DeepL plan limit is reached, purchases/upgrade are needed.
- Q: "The selected message says the cache expired."
  - A: The message translation cache is time-limited; run the `Translate (Choose Language)` command again on the message.
- Q: "How do I set my default target?"
  - A: Use `/preferred-language set language:"<code>"`.
- Q: "Are my keys safe?"
  - A: Yes — API keys are encrypted before storage and only used for making DeepL requests on your behalf.

---

## Quick Examples ✍️

- Set key:
  - `/key set api_key:"abcd1234" deepl_version:Free`
- Translate a sentence:
  - `/translate text:"Bonjour" target_lang:"en-US"`
- Set preferred language to German:
  - `/preferred-language set language:"de"`
- Translate a message (guild): Right-click → Apps → `Translate (Choose Language)` → choose language → Confirm

---

## Where to get help & feedback 📬

If you find a bug or want an enhancement, open an issue on GitHub please. For questions, reach out to the maintainer via the [contact form](https://tally.so/r/81NOJO).
