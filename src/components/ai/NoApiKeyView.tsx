// src/components/ai/NoApiKeyView.tsx
import { useTranslation } from "react-i18next";

export function NoApiKeyView() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-4">
      <p className="text-muted-foreground">{t("aiPanel.noApiKey")}</p>
    </div>
  );
}
