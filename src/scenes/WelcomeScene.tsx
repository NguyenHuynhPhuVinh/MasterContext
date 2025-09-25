// src/scenes/WelcomeScene.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Folder, History, Cog } from "lucide-react";
import { FaGithub, FaFacebook } from "react-icons/fa";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppStore, useAppActions } from "@/store/appStore";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { AnalysisSettingsDialog } from "@/components/AnalysisSettingsDialog";
import { useShallow } from "zustand/react/shallow";
import iconSrc from "@/assets/icon.png";

// Helper to get the last part of the path
const getProjectName = (path: string) => {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts.pop() || path;
};

export function WelcomeScene() {
  const { t } = useTranslation();
  const { selectRootPath, cloneAndOpenProject, updateAppSettings } =
    useAppActions();
  const { recentPaths, nonAnalyzableExtensions } = useAppStore(
    useShallow((state) => ({
      recentPaths: state.recentPaths,
      nonAnalyzableExtensions: state.nonAnalyzableExtensions,
    }))
  );
  const isScanning = useAppStore((state) => state.isScanning);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [gitUrl, setGitUrl] = useState("");

  const handleSelectFolder = async () => {
    try {
      const result = await open({
        directory: true,
        multiple: false,
        title: t("welcomeScene.selectFolderTitle"),
      });
      if (typeof result === "string") {
        selectRootPath(result);
      }
    } catch (error) {
      console.error("Lỗi khi chọn thư mục:", error);
    }
  };

  const handleCloneProject = async () => {
    if (gitUrl.trim()) {
      await cloneAndOpenProject(gitUrl.trim());
    }
  };

  const handleSaveSettings = (extensions: string[]) => {
    updateAppSettings({ nonAnalyzableExtensions: extensions });
  };

  return (
    <div className="relative w-full h-full">
      <main className="flex w-full h-full flex-1 flex-col items-center justify-center gap-8 p-8 text-center bg-muted/30">
        <img src={iconSrc} alt="Master Context Icon" className="h-32 w-32" />

        <p className="text-base text-muted-foreground font-normal">
          {t("welcomeScene.description")}
        </p>

        <div className="flex w-full max-w-xs flex-col items-center gap-6">
          <Button
            size="lg"
            onClick={handleSelectFolder}
            className="w-full"
            disabled={isScanning}
          >
            <Folder className="mr-2 h-5 w-5" />
            {t("welcomeScene.openProject")}
          </Button>

          <div className="flex w-full items-center gap-2">
            <Input
              placeholder={t("welcomeScene.gitUrlPlaceholder")}
              value={gitUrl}
              onChange={(e) => setGitUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCloneProject();
              }}
              disabled={isScanning}
            />
            <Button
              onClick={handleCloneProject}
              disabled={!gitUrl.trim() || isScanning}
            >
              Clone
            </Button>
          </div>

          {recentPaths.length > 0 && (
            <>
              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t"></span>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-muted/30 px-2 text-muted-foreground">
                    {t("welcomeScene.orOpenRecent")}
                  </span>
                </div>
              </div>

              <div className="w-full text-center">
                <h2 className="mb-3 flex items-center justify-center text-lg font-semibold">
                  <History className="mr-2 h-4 w-4" />
                  {t("welcomeScene.recentProjects")}
                </h2>
                <ScrollArea className="max-h-64 w-full rounded-md border bg-background/50 p-2">
                  <div className="space-y-1">
                    {recentPaths.map((path) => (
                      <Button
                        key={path}
                        variant="ghost"
                        className="h-auto w-full justify-start py-2 text-left"
                        onClick={() => selectRootPath(path)}
                      >
                        <div className="flex flex-col items-start overflow-hidden">
                          <span className="w-full truncate font-medium">
                            {getProjectName(path)}
                          </span>
                          <span className="w-full truncate text-xs text-muted-foreground">
                            {path}
                          </span>
                        </div>
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </div>
      </main>
      <div className="absolute bottom-4 left-4 text-xs text-muted-foreground">
        <p>
          beta v0.1.4 | by{" "}
          <a
            href="https://github.com/NguyenHuynhPhuVinh"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:text-foreground transition-colors"
          >
            TomiSakae
          </a>
        </p>
      </div>
      <div className="absolute bottom-4 right-4 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSettingsOpen(true)}
          title={t("welcomeScene.settingsTitle")}
        >
          <Cog className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" asChild>
          <a
            href="https://github.com/NguyenHuynhPhuVinh/MasterContext"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub"
          >
            <FaGithub className="h-4 w-4" />
          </a>
        </Button>
        <Button variant="ghost" size="icon" asChild>
          <a
            href="https://www.facebook.com/TomiSakaeAnime/"
            target="_blank"
            rel="noopener noreferrer"
            title="Facebook"
          >
            <FaFacebook className="h-4 w-4" />
          </a>
        </Button>
      </div>
      <AnalysisSettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialExtensions={nonAnalyzableExtensions}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
