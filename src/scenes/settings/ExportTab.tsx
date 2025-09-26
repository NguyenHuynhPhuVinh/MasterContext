// src/scenes/settings/ExportTab.tsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, Loader2 } from "lucide-react";

interface ExportTabProps {
  exportUseFullTree: boolean;
  setExportUseFullTree: (enabled: boolean) => void;
  exportWithLineNumbers: boolean;
  setExportWithLineNumbers: (enabled: boolean) => void;
  exportWithoutComments: boolean;
  setExportWithoutComments: (enabled: boolean) => void;
  exportSuperCompressed: boolean;
  setExportSuperCompressed: (enabled: boolean) => void;
  exportRemoveDebugLogs: boolean;
  setExportRemoveDebugLogs: (enabled: boolean) => void;
  exportExcludeExtensions: string[];
  setExportExcludeExtensions: (extensions: string[]) => Promise<void>;
}

export function ExportTab({
  exportUseFullTree,
  setExportUseFullTree,
  exportWithLineNumbers,
  setExportWithLineNumbers,
  exportWithoutComments,
  setExportWithoutComments,
  exportSuperCompressed,
  setExportSuperCompressed,
  exportRemoveDebugLogs,
  setExportRemoveDebugLogs,
  exportExcludeExtensions,
  setExportExcludeExtensions,
}: ExportTabProps) {
  const { t } = useTranslation();
  const [localExcludeText, setLocalExcludeText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalExcludeText(exportExcludeExtensions.join(", "));
  }, [exportExcludeExtensions]);

  const handleSave = async () => {
    setIsSaving(true);
    const extensions = localExcludeText
      .split(",")
      .map((s) => s.trim().toLowerCase().replace(/^\./, "")) // remove leading dots
      .filter(Boolean);
    await setExportExcludeExtensions([...new Set(extensions)]);
    setIsSaving(false);
  };
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{t("settings.export.title")}</h2>
      <div className="space-y-4 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <Label
            htmlFor="export-tree-toggle"
            className="flex flex-col items-start gap-1"
          >
            <span>{t("settings.export.fullTree.label")}</span>
            <span className="text-xs text-muted-foreground">
              {t("settings.export.fullTree.description")}
            </span>
          </Label>
          <Switch
            id="export-tree-toggle"
            checked={exportUseFullTree}
            onCheckedChange={setExportUseFullTree}
          />
        </div>
        <div className="flex items-center justify-between pt-4 border-t">
          <Label
            htmlFor="export-lines-toggle"
            className={cn(
              "flex flex-col items-start gap-1",
              exportSuperCompressed && "opacity-50"
            )}
          >
            <span>{t("settings.export.lineNumbers.label")}</span>
            <span className="text-xs text-muted-foreground">
              {t("settings.export.lineNumbers.description")}
            </span>
          </Label>
          <Switch
            id="export-lines-toggle"
            checked={exportWithLineNumbers}
            onCheckedChange={setExportWithLineNumbers}
            disabled={exportSuperCompressed}
          />
        </div>
        <div className="flex items-center justify-between pt-4 border-t">
          <Label
            htmlFor="export-super-compressed-toggle"
            className={cn(
              "flex flex-col items-start gap-1",
              exportWithLineNumbers && "opacity-50"
            )}
          >
            <span>{t("settings.export.superCompressed.label")}</span>
            <span className="text-xs text-muted-foreground">
              {t("settings.export.superCompressed.description")}
            </span>
          </Label>
          <Switch
            id="export-super-compressed-toggle"
            checked={exportSuperCompressed}
            onCheckedChange={setExportSuperCompressed}
            disabled={exportWithLineNumbers}
          />
        </div>
        <div className="flex items-center justify-between pt-4 border-t">
          <Label
            htmlFor="export-comments-toggle"
            className="flex flex-col items-start gap-1"
          >
            <span>{t("settings.export.removeComments.label")}</span>
            <span className="text-xs text-muted-foreground">
              {t("settings.export.removeComments.description")}
            </span>
          </Label>
          <Switch
            id="export-comments-toggle"
            checked={exportWithoutComments}
            onCheckedChange={setExportWithoutComments}
          />
        </div>
        <div className="flex items-center justify-between pt-4 border-t">
          <Label
            htmlFor="export-debug-toggle"
            className="flex flex-col items-start gap-1"
          >
            <span>{t("settings.export.removeDebug.label")}</span>
            <span className="text-xs text-muted-foreground">
              {t("settings.export.removeDebug.description")}
            </span>
          </Label>
          <Switch
            id="export-debug-toggle"
            checked={exportRemoveDebugLogs}
            onCheckedChange={setExportRemoveDebugLogs}
          />
        </div>
        <div className="flex flex-col space-y-3 pt-4 border-t">
          <div className="flex flex-col items-start gap-1">
            <Label htmlFor="export-exclude-extensions">
              {t("settings.export.excludeExtensions.label")}
            </Label>
            <span className="text-xs text-muted-foreground">
              {t("settings.export.excludeExtensions.description")}
            </span>
          </div>
          <Input
            id="export-exclude-extensions"
            placeholder={t("settings.export.excludeExtensions.placeholder")}
            value={localExcludeText}
            onChange={(e) => setLocalExcludeText(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            {t("settings.export.excludeExtensions.hint")}
          </p>
          <Button
            onClick={handleSave}
            disabled={
              isSaving ||
              localExcludeText === exportExcludeExtensions.join(", ")
            }
            className="w-full mt-2"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {t("settings.export.excludeExtensions.saveButton")}
          </Button>
        </div>
      </div>
    </div>
  );
}
