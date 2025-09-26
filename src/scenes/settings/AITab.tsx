// src/scenes/settings/AITab.tsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Loader2 } from "lucide-react";

interface AITabProps {
  apiKey: string;
  model: string;
  onSave: (settings: { apiKey: string; model: string }) => Promise<void>;
}

export function AITab({ apiKey, model, onSave: onSaveProp }: AITabProps) {
  const { t } = useTranslation();
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localModel, setLocalModel] = useState(model);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalApiKey(apiKey);
    setLocalModel(model);
  }, [apiKey, model]);

  const handleSave = async () => {
    setIsSaving(true);
    await onSaveProp({ apiKey: localApiKey, model: localModel });
    setIsSaving(false);
  };

  const isChanged = localApiKey !== apiKey || localModel !== model;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{t("settings.ai.title")}</h2>
      <div className="space-y-4 rounded-lg border p-4">
        <div className="space-y-2">
          <Label htmlFor="openrouter-api-key">
            {t("settings.ai.openRouter.apiKeyLabel")}
          </Label>
          <Input
            id="openrouter-api-key"
            type="password"
            value={localApiKey}
            onChange={(e) => setLocalApiKey(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ai-model">
            {t("settings.ai.openRouter.modelLabel")}
          </Label>
          <Input
            id="ai-model"
            value={localModel}
            onChange={(e) => setLocalModel(e.target.value)}
          />
        </div>
        <div className="pt-2">
          <Button
            onClick={handleSave}
            disabled={isSaving || !isChanged}
            className="w-full"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {t("common.saveChanges")}
          </Button>
        </div>
      </div>
    </div>
  );
}
