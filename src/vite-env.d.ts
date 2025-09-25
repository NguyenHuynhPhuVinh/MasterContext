/// <reference types="vite/client" />

// src/vite-env.d.ts
import "react-i18next";
import type translation from "./locales/vi/translation.json";

declare module "react-i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      translation: typeof translation;
    };
  }
}
