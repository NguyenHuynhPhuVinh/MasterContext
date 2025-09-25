// src/scenes/settings/AppearanceTab.tsx
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AppearanceTab() {
  const { t, i18n } = useTranslation();

  const handleLanguageChange = (language: string) => {
    i18n.changeLanguage(language);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{t("appearanceTab.title")}</h2>
      <div className="flex items-center justify-between rounded-lg border p-4">
        <Label htmlFor="theme-toggle" className="text-base">
          {t("appearanceTab.themeLabel")}
        </Label>
        <ThemeToggle />
      </div>
      <div className="flex items-center justify-between rounded-lg border p-4">
        <Label htmlFor="language-select" className="text-base">
          {t("appearanceTab.languageLabel")}
        </Label>
        <Select value={i18n.language} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("appearanceTab.selectLanguage")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vi">{t("appearanceTab.vietnamese")}</SelectItem>
            <SelectItem value="en">{t("appearanceTab.english")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
