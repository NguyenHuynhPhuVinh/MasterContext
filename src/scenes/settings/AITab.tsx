// src/scenes/settings/AITab.tsx
import { useState, useEffect } from "react";
import { useTranslation, Trans } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Save, Loader2, X, ChevronsUpDown } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useShallow } from "zustand/react/shallow";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { type AIModel } from "@/store/types";

interface AITabProps {
  apiKey: string;
  models: AIModel[]; // This is AIModel[]
  streamResponse: boolean;
  systemPrompt: string;
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  onSave: (settings: {
    apiKey: string;
    models: string[]; // should send back IDs
    streamResponse: boolean;
    systemPrompt: string;
    temperature: number;
    topP: number;
    topK: number;
    maxTokens: number;
  }) => Promise<void>;
}

export function AITab({
  apiKey,
  models, // This is AIModel[]
  streamResponse,
  systemPrompt,
  temperature,
  topP,
  topK,
  maxTokens,
  onSave,
}: AITabProps) {
  const { t } = useTranslation();
  const { allAvailableModels } = useAppStore(
    useShallow((state) => ({
      allAvailableModels: state.allAvailableModels,
    }))
  );
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localModels, setLocalModels] = useState(models.map((m) => m.id));
  const [localStreamResponse, setLocalStreamResponse] =
    useState(streamResponse);
  const [localSystemPrompt, setLocalSystemPrompt] = useState(systemPrompt);
  const [localTemperature, setLocalTemperature] = useState(temperature);
  const [localTopP, setLocalTopP] = useState(topP);
  const [localTopK, setLocalTopK] = useState(topK);
  const [localMaxTokens, setLocalMaxTokens] = useState(maxTokens);
  const [isSaving, setIsSaving] = useState(false);
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);

  useEffect(() => {
    setLocalApiKey(apiKey);
    setLocalModels(models.map((m) => m.id));
    setLocalStreamResponse(streamResponse);
    setLocalSystemPrompt(systemPrompt);
    setLocalTemperature(temperature);
    setLocalTopP(topP);
    setLocalTopK(topK);
    setLocalMaxTokens(maxTokens);
  }, [
    apiKey,
    models,
    streamResponse,
    systemPrompt,
    temperature,
    topP,
    topK,
    maxTokens,
  ]);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave({
      apiKey: localApiKey,
      models: localModels,
      streamResponse: localStreamResponse,
      systemPrompt: localSystemPrompt,
      temperature: localTemperature,
      topP: localTopP,
      topK: localTopK,
      maxTokens: localMaxTokens,
    });
    setIsSaving(false);
  };

  const handleRemoveModel = (modelToRemove: string) => {
    // Prevent removing the last model
    if (localModels.length > 1) {
      setLocalModels(localModels.filter((m) => m !== modelToRemove));
    }
  };

  // Deep equality check for array
  const modelsChanged =
    JSON.stringify(localModels.sort()) !==
    JSON.stringify(models.map((m) => m.id).sort());

  const isChanged =
    localApiKey !== apiKey ||
    modelsChanged ||
    localStreamResponse !== streamResponse ||
    localSystemPrompt !== systemPrompt ||
    localTemperature !== temperature ||
    localTopP !== topP ||
    localTopK !== topK ||
    localMaxTokens !== maxTokens;

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
          <p className="text-xs text-muted-foreground">
            <Trans
              i18nKey="settings.ai.openRouter.getApiKeyHint"
              components={{
                1: (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      openUrl("https://openrouter.ai/settings/keys");
                    }}
                    className="text-primary underline hover:no-underline"
                  />
                ),
              }}
            />
          </p>
        </div>
        <div className="space-y-2">
          <Label>{t("settings.ai.openRouter.modelLabel")}</Label>
          <div className="flex flex-wrap gap-2 rounded-lg border p-2 min-h-[40px]">
            {allAvailableModels
              .filter((m) => localModels.includes(m.id))
              .map((model) => (
                <Badge key={model.id} variant="secondary" className="pl-3 pr-1">
                  {model.id}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-1 h-5 w-5 rounded-full"
                    onClick={() => handleRemoveModel(model.id)}
                    disabled={localModels.length <= 1}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
          </div>
          <Popover open={isModelPickerOpen} onOpenChange={setIsModelPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={isModelPickerOpen}
                className="w-full justify-between"
              >
                Thêm một model...
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
              <Command>
                <CommandInput placeholder="Tìm kiếm model..." />
                {/* Thay đổi: Sử dụng ScrollArea của dự án */}
                <ScrollArea className="h-[250px]">
                  <CommandList>
                    <CommandEmpty>
                      {allAvailableModels.length === 0
                        ? "Đang tải models..."
                        : "Không tìm thấy model."}
                    </CommandEmpty>
                    <CommandGroup>
                      {allAvailableModels
                        .filter((model) => !localModels.includes(model.id))
                        .map((model) => (
                          <CommandItem
                            key={model.id}
                            // Thay đổi: value chỉ là id để xử lý onSelect dễ dàng hơn
                            value={model.id}
                            // SỬA LỖI DỨT ĐIỂM: Ngăn Popover "nuốt" sự kiện click
                            onPointerDown={(e) => e.preventDefault()}
                            // Thay đổi: Sửa logic onSelect để hoạt động ổn định
                            onSelect={(currentValue) => {
                              setLocalModels((prev) => [...prev, currentValue]);
                              setIsModelPickerOpen(false);
                            }}
                          >
                            <div className="flex flex-col">
                              <span>{model.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {model.id}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </ScrollArea>
              </Command>
            </PopoverContent>
          </Popover>
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
        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="font-semibold">{t("settings.ai.parameters.title")}</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="temperature-slider">
                {t("settings.ai.parameters.temperature")}
              </Label>
              <span className="text-sm text-muted-foreground">
                {localTemperature.toFixed(2)}
              </span>
            </div>
            <Slider
              id="temperature-slider"
              value={[localTemperature]}
              onValueChange={(value) => setLocalTemperature(value[0])}
              min={0}
              max={2}
              step={0.01}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="topp-slider">
                {t("settings.ai.parameters.topP")}
              </Label>
              <span className="text-sm text-muted-foreground">
                {localTopP.toFixed(2)}
              </span>
            </div>
            <Slider
              id="topp-slider"
              value={[localTopP]}
              onValueChange={(value) => setLocalTopP(value[0])}
              min={0}
              max={1}
              step={0.01}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="topk-input">
                {t("settings.ai.parameters.topK")}
              </Label>
              <Input
                id="topk-input"
                type="number"
                value={localTopK}
                onChange={(e) =>
                  setLocalTopK(parseInt(e.target.value, 10) || 0)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxtokens-input">
                {t("settings.ai.parameters.maxTokens")}
              </Label>
              <Input
                id="maxtokens-input"
                type="number"
                value={localMaxTokens}
                onChange={(e) =>
                  setLocalMaxTokens(parseInt(e.target.value, 10) || 0)
                }
              />
            </div>
          </div>
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
