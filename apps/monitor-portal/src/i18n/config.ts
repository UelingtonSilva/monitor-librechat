import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Auto-discovers every locales/<lng>/<namespace>.json file at build time, so adding a new
// namespace is just adding a JSON file — nothing here needs to change.
const modules = import.meta.glob<{ default: Record<string, unknown> }>("../locales/*/*.json", {
  eager: true,
});

const resources: Record<string, Record<string, Record<string, unknown>>> = {};
const namespaceSet = new Set<string>();

for (const [path, mod] of Object.entries(modules)) {
  const match = path.match(/locales\/([^/]+)\/([^/]+)\.json$/);
  if (!match) continue;
  const [, lng, ns] = match;
  resources[lng] ??= {};
  resources[lng][ns] = mod.default;
  namespaceSet.add(ns);
}

const STORAGE_KEY = "monitor.lang";

function detectLanguage(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && resources[stored]) return stored;
  } catch {
    // localStorage unavailable (private mode, disabled storage) — fall through to detection.
  }
  const browser = navigator.language;
  if (resources[browser]) return browser;
  const short = browser.split("-")[0];
  const match = Object.keys(resources).find((lng) => lng.split("-")[0] === short);
  return match ?? "en";
}

i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: "en",
  ns: [...namespaceSet],
  defaultNS: "common",
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

i18n.on("languageChanged", (lng) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // Best-effort persistence only; the language still applies for this session.
  }
});

export default i18n;
