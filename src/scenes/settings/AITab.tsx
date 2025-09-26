// src/scenes/settings/AITab.tsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Save, Loader2 } from "lucide-react";

interface AITabProps {
  apiKey: string;
  model: string;
  streamResponse: boolean;
  systemPrompt: string;
  onSave: (settings: {
    apiKey: string;
    model: string;
    streamResponse: boolean;
    systemPrompt: string;
  }) => Promise<void>;
}

export function AITab({
  apiKey,
  model,
  streamResponse,
  systemPrompt,
  onSave: onSaveProp,
}: AITabProps) {
  const { t } = useTranslation();
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localModel, setLocalModel] = useState(model);
  const [localStreamResponse, setLocalStreamResponse] =
    useState(streamResponse);
  const [localSystemPrompt, setLocalSystemPrompt] = useState(systemPrompt);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalApiKey(apiKey);
    setLocalModel(model);
    setLocalStreamResponse(streamResponse);
    setLocalSystemPrompt(systemPrompt);
  }, [apiKey, model, streamResponse, systemPrompt]);

  const handleSave = async () => {
    setIsSaving(true);
    await onSaveProp({
      apiKey: localApiKey,
      model: localModel,
      streamResponse: localStreamResponse,
      systemPrompt: localSystemPrompt,
    });
    setIsSaving(false);
  };

  const isChanged =
    localApiKey !== apiKey ||
    localModel !== model ||
    localStreamResponse !== streamResponse ||
    localSystemPrompt !== systemPrompt;

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
        <div className="flex items-center justify-between pt-4 border-t">
          <Label
            htmlFor="stream-response-toggle"
            className="flex flex-col items-start gap-1"
          >
            <span>{t("settings.ai.streamResponse.label")}</span>
            <span className="text-xs text-muted-foreground">
              {t("settings.ai.streamResponse.description")}
            </span>
          </Label>
          <Switch
            id="stream-response-toggle"
            checked={localStreamResponse}
            onCheckedChange={setLocalStreamResponse}
          />
        </div>
        <div className="flex flex-col space-y-3 pt-4 border-t">
          <div className="flex flex-col items-start gap-1">
            <Label htmlFor="system-prompt">
              {t("settings.ai.systemPrompt.title")}
            </Label>
            <span className="text-xs text-muted-foreground">
              {t("settings.ai.systemPrompt.description")}
            </span>
          </div>
          <Textarea
            id="system-prompt"
            placeholder={t("settings.ai.systemPrompt.placeholder")}
            className="min-h-[100px] resize-y"
            value={localSystemPrompt}
            onChange={(e) => setLocalSystemPrompt(e.target.value)}
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
