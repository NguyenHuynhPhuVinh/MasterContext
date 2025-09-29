// src/scenes/settings/ProjectTab.tsx
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertTriangle, FolderUp, GitBranch } from "lucide-react";
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
  syncEnabled: boolean;
  handleToggleSync: (enabled: boolean) => void;
  syncPath: string | null;
  handleChooseSyncPath: () => void;
  gitExportModeIsContext: boolean;
  setGitExportMode: (enabled: boolean) => Promise<void>;
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
  syncEnabled,
  handleToggleSync,
  syncPath,
  handleChooseSyncPath,
  gitExportModeIsContext,
  setGitExportMode,
}: ProjectTabProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{t("settings.project.title")}</h2>
      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="font-semibold">
          {t("settings.project.watching.title")}
        </h3>
        <div className="flex items-center justify-between">
          <Label
            htmlFor="watching-toggle"
            className="flex flex-col items-start"
          >
            <span>{t("settings.project.watching.enable.label")}</span>
            <span className="text-xs text-muted-foreground">
              {t("settings.project.watching.enable.description")}
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

      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="font-semibold">{t("settings.autoSync.title")}</h3>
        <div className="flex items-center justify-between">
          <Label htmlFor="sync-toggle" className="flex flex-col items-start">
            <span>{t("settings.autoSync.enable.label")}</span>
            <span className="text-xs text-muted-foreground">
              {t("settings.autoSync.enable.description")}
            </span>
          </Label>
          <Switch
            id="sync-toggle"
            checked={syncEnabled}
            onCheckedChange={handleToggleSync}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sync-path">
            {t("settings.autoSync.folder.label")}
          </Label>
          <div className="flex items-center gap-2">
            <div
              id="sync-path"
              className="flex-grow truncate rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground"
            >
              {syncPath || t("settings.autoSync.folder.placeholder")}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleChooseSyncPath}
            >
              <FolderUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="font-semibold flex items-center gap-2">
          <GitBranch className="h-4 w-4" /> {t("settings.git.title")}
        </h3>
        <div className="flex items-center justify-between">
          <Label
            htmlFor="git-export-mode-toggle"
            className="flex flex-col items-start"
          >
            <span>{t("settings.git.contextMode.label")}</span>
            <span className="text-xs text-muted-foreground">
              {t("settings.git.contextMode.description")}
            </span>
          </Label>
          <Switch
            id="git-export-mode-toggle"
            checked={gitExportModeIsContext}
            onCheckedChange={setGitExportMode}
          />
        </div>
      </div>

      <div className="space-y-4 rounded-lg border p-4 flex flex-col">
        <h3 className="font-semibold">{t("settings.project.ignore.title")}</h3>
        <div className="space-y-2 flex-grow flex flex-col">
          <Label htmlFor="custom-ignore">
            {t("settings.project.ignore.label")}
          </Label>
          <Textarea
            id="custom-ignore"
            placeholder={t("settings.project.ignore.placeholder")}
            className="flex-1 resize-y min-h-[120px]"
            value={ignoreText}
            onChange={(e) => setIgnoreText(e.target.value)}
            disabled={isSaving}
          />
          <p className="text-xs text-muted-foreground">
            {t("settings.project.ignore.description")}
          </p>
        </div>
        <Button
          onClick={handleSaveIgnorePatterns}
          disabled={isSaving}
          className="w-full mt-4"
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("settings.project.ignore.saveButton")}
        </Button>
      </div>

      <div className="space-y-4 rounded-lg border border-destructive/50 p-4">
        <h3 className="font-semibold text-destructive flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          {t("settings.project.dangerZone.title")}
        </h3>
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-start pr-4">
            <span>{t("settings.project.dangerZone.deleteData.label")}</span>
            <span className="text-xs text-muted-foreground">
              {t("settings.project.dangerZone.deleteData.description")}
            </span>
          </div>
          <Button
            variant="destructive"
            onClick={() => setIsDeleteProjectDialogOpen(true)}
          >
            {t("settings.project.dangerZone.deleteData.button")}
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
              {t("settings.project.dangerZone.deleteDialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.project.dangerZone.deleteDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleConfirmDeleteProjectData}
            >
              {t("settings.project.dangerZone.deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
