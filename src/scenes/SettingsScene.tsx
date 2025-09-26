// src/scenes/SettingsScene.tsx
import { useSettingsScene } from "@/hooks/useSettingsScene";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  FileText,
  X,
  Palette,
  FolderCog,
  User,
  FileOutput,
  Bot,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppearanceTab } from "./settings/AppearanceTab";
import { ProjectTab } from "./settings/ProjectTab";
import { ProfileTab } from "./settings/ProfileTab";
import { ExportTab } from "./settings/ExportTab";
import { AITab } from "./settings/AITab"; // THÊM IMPORT
import { type SettingsTab } from "@/hooks/useSettingsScene";

export function SettingsScene() {
  const { t } = useTranslation();
  const {
    activeTab,
    setActiveTab,
    syncEnabled,
    syncPath,
    activeProfile,
    isWatchingFiles,
    rootPath,
    exportUseFullTree,
    exportWithLineNumbers,
    exportWithoutComments,
    exportRemoveDebugLogs,
    exportSuperCompressed,
    alwaysApplyText,
    exportExcludeExtensions,
    gitExportModeIsContext,
    openRouterApiKey,
    aiModel,
    streamResponse,
    updateAppSettings,
    setGitExportMode,
    showDashboard,
    setFileWatching,
    setExportUseFullTree,
    setExportWithLineNumbers,
    setExportWithoutComments,
    setExportRemoveDebugLogs,
    setExportSuperCompressed,
    setAlwaysApplyText,
    setExportExcludeExtensions,
    handleToggleSync,
    handleChooseSyncPath,
    ignoreText,
    setIgnoreText,
    isSaving,
    handleSaveIgnorePatterns,
    isDeleteProjectDialogOpen,
    setIsDeleteProjectDialogOpen,
    handleConfirmDeleteProjectData,
  } = useSettingsScene();

  const TABS = [
    {
      id: "appearance",
      label: t("settings.tabs.appearance"),
      icon: Palette,
    },
    { id: "project", label: t("settings.tabs.project"), icon: FolderCog },
    { id: "profile", label: t("settings.tabs.profile"), icon: User },
    { id: "export", label: t("settings.tabs.export"), icon: FileOutput },
    { id: "ai", label: t("settings.tabs.ai"), icon: Bot }, // THÊM TAB
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "appearance":
        return <AppearanceTab />;
      case "project":
        return (
          <ProjectTab
            isWatchingFiles={isWatchingFiles}
            setFileWatching={setFileWatching}
            rootPath={rootPath}
            ignoreText={ignoreText}
            setIgnoreText={setIgnoreText}
            isSaving={isSaving}
            handleSaveIgnorePatterns={handleSaveIgnorePatterns}
            isDeleteProjectDialogOpen={isDeleteProjectDialogOpen}
            setIsDeleteProjectDialogOpen={setIsDeleteProjectDialogOpen}
            handleConfirmDeleteProjectData={handleConfirmDeleteProjectData}
          />
        );
      case "profile":
        return (
          <ProfileTab
            syncEnabled={syncEnabled}
            handleToggleSync={handleToggleSync}
            syncPath={syncPath}
            handleChooseSyncPath={handleChooseSyncPath}
            alwaysApplyText={alwaysApplyText}
            setAlwaysApplyText={setAlwaysApplyText}
            gitExportModeIsContext={gitExportModeIsContext}
            setGitExportMode={setGitExportMode}
          />
        );
      case "export":
        return (
          <ExportTab
            exportUseFullTree={exportUseFullTree}
            setExportUseFullTree={setExportUseFullTree}
            exportWithLineNumbers={exportWithLineNumbers}
            setExportWithLineNumbers={setExportWithLineNumbers}
            exportWithoutComments={exportWithoutComments}
            setExportWithoutComments={setExportWithoutComments}
            exportSuperCompressed={exportSuperCompressed}
            setExportSuperCompressed={setExportSuperCompressed}
            exportRemoveDebugLogs={exportRemoveDebugLogs}
            setExportRemoveDebugLogs={setExportRemoveDebugLogs}
            exportExcludeExtensions={exportExcludeExtensions}
            setExportExcludeExtensions={setExportExcludeExtensions}
          />
        );
      case "ai":
        return (
          <AITab
            apiKey={openRouterApiKey}
            model={aiModel}
            streamResponse={streamResponse}
            onSave={async ({ apiKey, model, streamResponse }) => {
              await updateAppSettings({
                openRouterApiKey: apiKey,
                aiModel: model,
                streamResponse: streamResponse,
              });
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between p-4 border-b shrink-0">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
            <Badge variant="secondary" className="gap-2">
              <FileText className="h-4 w-4" />
              {t("settings.profileBadge")}:{" "}
              <span className="font-semibold">{activeProfile}</span>
            </Badge>
          </div>
          <p className="text-muted-foreground">{t("settings.description")}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={showDashboard}>
          <X className="h-5 w-5" />
          <span className="sr-only">{t("common.close")}</span>
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Thanh điều hướng bên trái */}
        <nav className="w-56 border-r p-4">
          <ul className="space-y-1">
            {TABS.map((tab) => (
              <li key={tab.id}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-3",
                    activeTab === tab.id && "bg-accent"
                  )}
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </Button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Nội dung bên phải được bọc trong ScrollArea */}
        <ScrollArea className="flex-1">
          <main className="p-6">
            <div className="max-w-2xl mx-auto">{renderContent()}</div>
          </main>
        </ScrollArea>
      </div>
    </div>
  );
}
