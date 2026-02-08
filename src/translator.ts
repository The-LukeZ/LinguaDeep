import { Translator as DeeplTranslator, DeepLError, SourceLanguageCode, TargetLanguageCode } from "deepl-node";

type WithError<T> = T | { error: string };

export class Translator {
  private client: DeeplTranslator;

  constructor(deeplKey: string) {
    this.client = this.makeDeeplClient(deeplKey);
  }

  private makeDeeplClient(deeplApiKey: string): DeeplTranslator {
    return new DeeplTranslator(deeplApiKey, {
      appInfo: { appName: "LinguaDeep Discord Bot (https://linguadeep.thelukez.com)", appVersion: "1.0.0" },
      maxRetries: 3,
      sendPlatformInfo: true,
    });
  }

  private async withHandleError<T>(fn: () => Promise<T>): Promise<WithError<T>> {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      if (error instanceof DeepLError) {
        return { error: error.message };
      }
      return { error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  async translate(text: string, targetLang: TargetLanguageCode, sourceLang: SourceLanguageCode | null = null) {
    return this.withHandleError(async () => {
      const translated = await this.client.translateText(text, sourceLang, targetLang);
      return translated;
    });
  }

  async getUsage() {
    return this.withHandleError(async () => {
      const usage = await this.client.getUsage();
      return usage;
    });
  }
}
