import * as expoLocalization from "expo-localization";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import tr from "./tr.json";

const resources = {
  en: { translation: en },
  tr: { translation: tr },
} as const;

const systemLanguage = expoLocalization.getLocales()?.[0]?.languageCode ?? "en";
const supportedLanguages = Object.keys(resources);
const fallbackLng = supportedLanguages.includes(systemLanguage)
  ? systemLanguage
  : "en";

const initPromise = i18next.use(initReactI18next).init({
  resources,
  fallbackLng,
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: "v4",
  react: {
    useSuspense: false,
  },
});

export { initPromise };
export default i18next;
