import type { LanguageCode, SourceLanguageCode, TargetLanguageCode } from "deepl-node";
import { MessageFlags } from "discord-api-types/v10";

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
