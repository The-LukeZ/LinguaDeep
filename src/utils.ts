import { DeepLClient, type LanguageCode, type SourceLanguageCode, type TargetLanguageCode } from "deepl-node";
import { APIInteraction, MessageFlags } from "discord-api-types/v10";
import { Cryption, makeCryptor } from "./cryption";

export type CommonLanguageCode = Exclude<SourceLanguageCode, "en" | "pt">;

export const AllLanguages: Record<LanguageCode, string> = {
  ar: "Arabic",
  bg: "Bulgarian",
  cs: "Czech",
  da: "Danish",
  de: "German",
  el: "Greek",
  en: "English",
  "en-GB": "English (British)",
  "en-US": "English (American)",
  es: "Spanish",
  et: "Estonian",
  fi: "Finnish",
  fr: "French",
  he: "Hebrew",
  hu: "Hungarian",
  id: "Indonesian",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  lt: "Lithuanian",
  lv: "Latvian",
  nb: "Norwegian Bokmål",
  nl: "Dutch",
  pl: "Polish",
  ro: "Romanian",
  ru: "Russian",
  sk: "Slovak",
  sl: "Slovenian",
  sv: "Swedish",
  th: "Thai",
  tr: "Turkish",
  uk: "Ukrainian",
  vi: "Vietnamese",
  zh: "Chinese",
  "pt-BR": "Portuguese (Brazilian)",
  "pt-PT": "Portuguese (European)",
  "zh-HANS": "Chinese (Simplified)",
  "zh-HANT": "Chinese (Traditional)",
  pt: "Portuguese",
} as const;

const CommonLanguages: Record<CommonLanguageCode, string> = {
  ar: "Arabic",
  bg: "Bulgarian",
  cs: "Czech",
  da: "Danish",
  de: "German",
  el: "Greek",
  es: "Spanish",
  et: "Estonian",
  fi: "Finnish",
  fr: "French",
  he: "Hebrew",
  hu: "Hungarian",
  id: "Indonesian",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  lt: "Lithuanian",
  lv: "Latvian",
  nb: "Norwegian Bokmål",
  nl: "Dutch",
  pl: "Polish",
  ro: "Romanian",
  ru: "Russian",
  sk: "Slovak",
  sl: "Slovenian",
  sv: "Swedish",
  th: "Thai",
  tr: "Turkish",
  uk: "Ukrainian",
  vi: "Vietnamese",
  zh: "Chinese",
} as const;

/**
 * Language codes that may be used as a source language.
 * Note: although the language code type definitions are case-sensitive, this package and the DeepL
 * API accept case-insensitive language codes.
 */
export const SourceLanguages: SourceLanguageCode[] = [...(Object.keys(CommonLanguages) as CommonLanguageCode[]), "en", "pt"];

/**
 * Language codes that may be used as a target language.
 * Note: although the language code type definitions are case-sensitive, this package and the DeepL
 * API accept case-insensitive language codes.
 */
export const TargetLanguages: TargetLanguageCode[] = [
  ...(Object.keys(CommonLanguages) as CommonLanguageCode[]),
  "en-GB",
  "en-US",
  "pt-BR",
  "pt-PT",
  "zh-HANS",
  "zh-HANT",
];

export const EphemeralFlag = MessageFlags.Ephemeral;
export const V2Flag = MessageFlags.IsComponentsV2;
export const V2EphemeralFlag = EphemeralFlag | V2Flag;

export const ackRequest = () => new Response(null, { status: 204 });

export enum DeeplVersion {
  Free = 1,
  Pro = 2,
}

export class UserSetting {
  constructor(
    public readonly deeplApiKey: string,
    public readonly deeplVersion: DeeplVersion = DeeplVersion.Free,
  ) {}
}

type DBUserSetting = {
  deepl_api_key: string;
  deepl_version: DeeplVersion;
};

export class DBHelper {
  readonly db: D1Database;
  readonly cryptor: Cryption;

  constructor(db: D1Database) {
    this.db = db;
    this.cryptor = makeCryptor();
  }

  async getSetting(userId: string): Promise<UserSetting | null> {
    const res = await this.db
      .prepare("SELECT deepl_api_key, deepl_version FROM settings WHERE user_id = ?")
      .bind(userId)
      .first<DBUserSetting>();
    if (!res) return null;
    return new UserSetting(this.cryptor.decrypt(res.deepl_api_key), res.deepl_version);
  }

  async setSetting(userId: string, apiKey: string, deeplVersion: DeeplVersion = DeeplVersion.Free): Promise<void> {
    const valueStr = JSON.stringify(this.cryptor.encrypt(apiKey));
    await this.db
      .prepare(
        "INSERT INTO settings (user_id, deepl_api_key, deepl_version) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET deepl_api_key = excluded.deepl_api_key, deepl_version = excluded.deepl_version",
      )
      .bind(userId, valueStr, deeplVersion)
      .run();
  }

  async removeSetting(userId: string): Promise<void> {
    await this.db.prepare("DELETE FROM settings WHERE user_id = ?").bind(userId).run();
  }
}

export const DeeplServerUrls = {
  [DeeplVersion.Free]: "https://api-free.deepl.com",
  [DeeplVersion.Pro]: "https://api.deepl.com",
};

export function getUserIdFromInteraction<T extends APIInteraction>(interaction: T): string {
  return interaction.member ? interaction.member.user.id : interaction.user!.id;
}

export function makeDeeplClient(userCfg: UserSetting): DeepLClient {
  return new DeepLClient(userCfg.deeplApiKey, {
    appInfo: { appName: "LinguaDeep Discord Bot (https://linguadeep.thelukez.com)", appVersion: "0.0.0" },
    maxRetries: 3,
    sendPlatformInfo: true,
    serverUrl: DeeplServerUrls[userCfg.deeplVersion],
  });
}
