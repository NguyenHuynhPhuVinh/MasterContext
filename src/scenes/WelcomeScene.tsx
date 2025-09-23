// src/scenes/WelcomeScene.tsx
import { useState } from "react";
import { Folder, History, Cog } from "lucide-react";
import { FaGithub, FaFacebook } from "react-icons/fa";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppStore, useAppActions } from "@/store/appStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AnalysisSettingsDialog } from "@/components/AnalysisSettingsDialog";
import { useShallow } from "zustand/react/shallow";

// Helper to get the last part of the path
const getProjectName = (path: string) => {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts.pop() || path;
};

export function WelcomeScene() {
  const { selectRootPath, updateAppSettings } = useAppActions();
  const { recentPaths, nonAnalyzableExtensions } = useAppStore(
    useShallow((state) => ({
      recentPaths: state.recentPaths,
      nonAnalyzableExtensions: state.nonAnalyzableExtensions,
    }))
  );

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleSelectFolder = async () => {
    try {
      const result = await open({
        directory: true,
        multiple: false,
        title: "Chọn một thư mục dự án",
      });
      if (typeof result === "string") {
        selectRootPath(result);
      }
    } catch (error) {
      console.error("Lỗi khi chọn thư mục:", error);
    }
  };

  const handleSaveSettings = (extensions: string[]) => {
    updateAppSettings({ nonAnalyzableExtensions: extensions });
  };

  return (
    <div className="relative w-full h-full">
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center bg-muted/30 w-full h-full">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">
              <h1 className="text-4xl font-bold tracking-tight">
                Master Context
              </h1>
              <p className="text-base text-muted-foreground font-normal mt-2">
                Công cụ quản lý và tạo ngữ cảnh cho dự án của bạn.
              </p>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6 px-6 pb-8">
            <Button
              size="lg"
              onClick={handleSelectFolder}
              className="w-full max-w-xs"
            >
              <Folder className="mr-2 h-5 w-5" />
              Mở một dự án...
            </Button>

            {recentPaths.length > 0 && (
              <>
                <div className="relative w-full max-w-xs">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t"></span>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Hoặc
                    </span>
                  </div>
                </div>

                <div className="w-full max-w-xs text-center">
                  <h2 className="text-lg font-semibold mb-3 flex items-center justify-center">
                    <History className="mr-2 h-4 w-4" />
                    Mở gần đây
                  </h2>
                  <ScrollArea className="max-h-64 w-full rounded-md border p-2">
                    <div className="space-y-1">
                      {recentPaths.slice(0, 4).map((path) => (
                        <Button
                          key={path}
                          variant="ghost"
                          className="w-full justify-start text-left h-auto py-2"
                          onClick={() => selectRootPath(path)}
                        >
                          <div className="flex flex-col items-start overflow-hidden">
                            <span className="font-medium truncate w-full">
                              {getProjectName(path)}
                            </span>
                            <span className="text-xs text-muted-foreground truncate w-full">
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
          </CardContent>
        </Card>
      </main>
      <div className="absolute bottom-4 left-4 text-xs text-muted-foreground">
        <p>
          beta v0.1.3 | by{" "}
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
          title="Cài đặt"
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
