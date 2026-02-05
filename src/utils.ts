import { DeepLClient, TextResult, type LanguageCode, type SourceLanguageCode, type TargetLanguageCode } from "deepl-node";
import { APIInteraction, Locale, MessageFlags } from "discord-api-types/v10";
import { Cryption, makeCryptor } from "./cryption";
import { BaseInteraction, Colors, ContainerBuilder } from "honocord";

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
  pt: "Portuguese",
  "pt-BR": "Portuguese (Brazilian)",
  "pt-PT": "Portuguese (European)",
  "zh-HANS": "Chinese (Simplified)",
  "zh-HANT": "Chinese (Traditional)",
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

interface UserSettings {
  deeplApiKey: string;
  /**
   * @deprecated Automatically determined by the API key used. Just kept for backward compatibility.
   */
  deeplVersion?: DeeplVersion;
  /**
   * Preferred target language for translations. If null, no preference is set and needs to be derived from the user's locale.
   */
  preferredLanguage: TargetLanguageCode | null;
}

export class UserSetting implements UserSettings {
  constructor(
    public readonly deeplApiKey: string,
    public readonly preferredLanguage: TargetLanguageCode | null = null,
  ) {}
}

type DBUserSettings = {
  deepl_api_key: string;
  preferred_language: TargetLanguageCode | null;
};

export class DBHelper {
  readonly db: D1Database;
  readonly cryptor: Cryption;

  constructor(db: D1Database) {
    this.db = db;
    this.cryptor = makeCryptor();
  }

  /**
   * Retrieves user settings from the database for a given user ID.
   * @param userId - The unique identifier of the user
   * @returns A promise that resolves to a UserSetting object containing the decrypted API key and version,
   *          or null if no settings are found for the user
   * @throws May throw if database query fails or decryption fails
   */
  async getSetting(userId: string): Promise<UserSetting | null> {
    const res = await this.db
      .prepare("SELECT deepl_api_key, preferred_language FROM settings WHERE user_id = ?")
      .bind(userId)
      .first<DBUserSettings>();
    if (!res) return null;
    return new UserSetting(this.cryptor.decrypt(res.deepl_api_key), res.preferred_language);
  }

  /**
   * Sets or updates the DeepL API key and version for a user.
   *
   * @param userId - The unique identifier of the user
   * @param apiKey - The DeepL API key to be encrypted and stored
   * @param deeplVersion - The DeepL API version to use (defaults to Free tier)
   * @returns A promise that resolves when the key data has been successfully stored
   * @throws May throw an error if the database operation fails
   */
  async setKeyData(userId: string, apiKey: string, deeplVersion: DeeplVersion = DeeplVersion.Free): Promise<void> {
    const valueStr = JSON.stringify(this.cryptor.encrypt(apiKey));
    await this.db
      .prepare(
        "INSERT INTO settings (user_id, deepl_api_key) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET deepl_api_key = excluded.deepl_api_key",
      )
      .bind(userId, valueStr)
      .run();
  }

  /**
   * Unsets the DeepL API key and version for a user.
   * @param userId - The ID of the user whose API key data should be cleared
   * @returns A promise that resolves when the operation is complete
   */
  async unsetKeyData(userId: string): Promise<void> {
    await this.db.prepare("UPDATE settings SET deepl_api_key = NULL WHERE user_id = ?").bind(userId).run();
  }

  /**
   * Sets the preferred language for a user.
   * @param userId - The unique identifier of the user.
   * @param language - The target language code to set as preferred, or null to remove the preference.
   * @returns A promise that resolves when the operation completes.
   */
  async setPreferredLanguage(userId: string, language: TargetLanguageCode | null): Promise<void> {
    if (language === null) {
      await this.db.prepare("UPDATE settings SET preferred_language = NULL WHERE user_id = ?").bind(userId).run();
      return;
    }

    await this.db
      .prepare(
        "INSERT INTO settings (user_id, preferred_language) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET preferred_language = excluded.preferred_language",
      )
      .bind(userId, language)
      .run();
  }

  /**
   * Removes all settings for a specific user from the database.
   * @param userId - The ID of the user whose settings should be deleted.
   * @returns A promise that resolves when the deletion is complete.
   */
  async removeSettings(userId: string): Promise<void> {
    await this.db.prepare("DELETE FROM settings WHERE user_id = ?").bind(userId).run();
  }
}

export const DeeplServerUrls = {
  [DeeplVersion.Free]: "https://api-free.deepl.com",
  [DeeplVersion.Pro]: "https://api.deepl.com",
};

export function getUserIdFromInteraction<T extends BaseInteraction<any>>(interaction: T): string {
  return interaction.member ? interaction.member.user.id : interaction.user!.id;
}

export function makeDeeplClient(userCfg: UserSetting): DeepLClient {
  return new DeepLClient(userCfg.deeplApiKey, {
    appInfo: { appName: "LinguaDeep Discord Bot (https://linguadeep.thelukez.com)", appVersion: "0.0.0" },
    maxRetries: 3,
    sendPlatformInfo: true,
  });
}

export class Autocomplete {
  private _choices: { name: string; value: string }[] = [];
  private _focusedValue: string;

  constructor(focusedValue?: string) {
    this._focusedValue = focusedValue?.toLowerCase() || "";
  }

  choices(...choices: { name: string; value: string }[]): Autocomplete {
    this._choices.push(...choices);
    return this;
  }

  toJSON(): { name: string; value: string }[] {
    const filtered = this._choices.filter(
      (choice) => choice.name.toLowerCase().includes(this._focusedValue) || choice.value.toLowerCase().includes(this._focusedValue),
    );
    return filtered.slice(0, 25); // Discord only allows max 25 choices
  }
}

export function buildTranslatedMessage(deeplResponse: TextResult, targetLang: TargetLanguageCode) {
  return {
    embeds: [
      {
        author: {
          name: `🌐 From ${AllLanguages[deeplResponse.detectedSourceLang]} to ${AllLanguages[targetLang]}`,
        },
        description: deeplResponse.text,
        footer: {
          text: `Billed: ${deeplResponse.billedCharacters} characters`,
        },
      },
    ],
  };
}

export async function getPreferredTargetLanguage(
  userCfg: UserSettings | undefined | null,
  interactionLocale: string | Locale,
): Promise<TargetLanguageCode> {
  if (userCfg?.preferredLanguage) {
    return userCfg.preferredLanguage;
  }
  // Derive from interaction locale or fallback to en-US
  const localeLang = interactionLocale.slice(0, 2) as TargetLanguageCode;
  if (TargetLanguages.includes(localeLang)) {
    return localeLang;
  }
  return "en-US";
}

/**
 * Generates a standardized error response object for Discord interactions.
 * @param error The error message to be included in the response
 * @param withX Whether to include a "❌" symbol before the error message (default: true)
 * @returns An object representing the error response, suitable for sending to Discord
 */
export function errorResponse(error: string, withX = true) {
  return {
    flags: V2EphemeralFlag,
    components: [
      new ContainerBuilder().setAccentColor(Colors.Red).addTextDisplayComponents((t) => t.setContent(`${withX ? "❌ " : ""}${error}`)),
    ],
  };
}
