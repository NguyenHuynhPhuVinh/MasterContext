// src/scenes/settings/ProjectTab.tsx
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ProjectTabProps {
  isWatchingFiles: boolean;
  setFileWatching: (enabled: boolean) => void;
  rootPath: string | null;
  ignoreText: string;
  setIgnoreText: (text: string) => void;
  isSaving: boolean;
  handleSaveIgnorePatterns: () => void;
  isDeleteProjectDialogOpen: boolean;
  setIsDeleteProjectDialogOpen: (isOpen: boolean) => void;
  handleConfirmDeleteProjectData: () => void;
}

export function ProjectTab({
  isWatchingFiles,
  setFileWatching,
  rootPath,
  ignoreText,
  setIgnoreText,
  isSaving,
  handleSaveIgnorePatterns,
  isDeleteProjectDialogOpen,
  setIsDeleteProjectDialogOpen,
  handleConfirmDeleteProjectData,
}: ProjectTabProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{t("projectTab.title")}</h2>
      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="font-semibold">{t("projectTab.projectWatching")}</h3>
        <div className="flex items-center justify-between">
          <Label
            htmlFor="watching-toggle"
            className="flex flex-col items-start"
          >
            <span>{t("projectTab.realTimeWatching")}</span>
            <span className="text-xs text-muted-foreground">
              {t("projectTab.realTimeWatchingDescription")}
            </span>
          </Label>
          <Switch
            id="watching-toggle"
            checked={isWatchingFiles}
            onCheckedChange={setFileWatching}
            disabled={!rootPath}
          />
        </div>
      </div>

      <div className="space-y-4 rounded-lg border p-4 flex flex-col">
        <h3 className="font-semibold">
          {t("projectTab.customIgnorePatterns")}
        </h3>
        <div className="space-y-2 flex-grow flex flex-col">
          <Label htmlFor="custom-ignore">{t("projectTab.globPatterns")}</Label>
          <Textarea
            id="custom-ignore"
            placeholder={t("projectTab.ignorePatternsPlaceholder")}
            className="flex-1 resize-y min-h-[120px]"
            value={ignoreText}
            onChange={(e) => setIgnoreText(e.target.value)}
            disabled={isSaving}
          />
          <p className="text-xs text-muted-foreground">
            {t("projectTab.ignorePatternsDescription")}
          </p>
        </div>
        <Button
          onClick={handleSaveIgnorePatterns}
          disabled={isSaving}
          className="w-full mt-4"
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("projectTab.saveAndRescan")}
        </Button>
      </div>

      <div className="space-y-4 rounded-lg border border-destructive/50 p-4">
        <h3 className="font-semibold text-destructive flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          {t("projectTab.dangerZone")}
        </h3>
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-start pr-4">
            <span>{t("projectTab.deleteProjectData")}</span>
            <span className="text-xs text-muted-foreground">
              {t("projectTab.deleteProjectDataDescription")}
            </span>
          </div>
          <Button
            variant="destructive"
            onClick={() => setIsDeleteProjectDialogOpen(true)}
          >
            {t("projectTab.deleteData")}
          </Button>
        </div>
      </div>

      <AlertDialog
        open={isDeleteProjectDialogOpen}
        onOpenChange={setIsDeleteProjectDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("projectTab.confirmDeleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("projectTab.confirmDeleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleConfirmDeleteProjectData}
            >
              {t("projectTab.confirmDeleteAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
