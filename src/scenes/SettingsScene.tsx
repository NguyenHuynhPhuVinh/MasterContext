// src/scenes/SettingsScene.tsx
import { useSettingsScene } from "@/hooks/useSettingsScene";
import { Button } from "@/components/ui/button";
import {
  FileText,
  X,
  Palette,
  FolderCog,
  User,
  FileOutput,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppearanceTab } from "./settings/AppearanceTab";
import { ProjectTab } from "./settings/ProjectTab";
import { ProfileTab } from "./settings/ProfileTab";
import { ExportTab } from "./settings/ExportTab";
import { type SettingsTab } from "@/hooks/useSettingsScene";

export function SettingsScene() {
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
    alwaysApplyText,
    showDashboard,
    setFileWatching,
    setExportUseFullTree,
    setExportWithLineNumbers,
    setExportWithoutComments,
    setAlwaysApplyText,
    handleToggleSync,
    handleChooseSyncPath,
    ignoreText,
    setIgnoreText,
    isSaving,
    handleSaveIgnorePatterns,
  } = useSettingsScene();

  const TABS = [
    { id: "appearance", label: "Giao diện", icon: Palette },
    { id: "project", label: "Dự án", icon: FolderCog },
    { id: "profile", label: "Hồ sơ", icon: User },
    { id: "export", label: "Xuất File", icon: FileOutput },
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
            <h1 className="text-2xl font-bold">Cài đặt</h1>
            <Badge variant="secondary" className="gap-2">
              <FileText className="h-4 w-4" />
              Hồ sơ: <span className="font-semibold">{activeProfile}</span>
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Tùy chỉnh các thiết lập cho ứng dụng.
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={showDashboard}>
          <X className="h-5 w-5" />
          <span className="sr-only">Đóng</span>
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
