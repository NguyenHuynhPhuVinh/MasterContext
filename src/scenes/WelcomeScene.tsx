// src/scenes/WelcomeScene.tsx
import { Folder, History } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppStore, useAppActions } from "@/store/appStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useShallow } from "zustand/react/shallow";

// Helper to get the last part of the path
const getProjectName = (path: string) => {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts.pop() || path;
};

export function WelcomeScene() {
  const { selectRootPath } = useAppActions();
  const { recentPaths } = useAppStore(
    useShallow((state) => ({
      recentPaths: state.recentPaths,
    }))
  );

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

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center bg-muted/30 w-full h-full">
      <Card className="w-full max-w-3xl">
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
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col items-center justify-center p-6 border rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Bắt đầu</h2>
            <Button size="lg" onClick={handleSelectFolder} className="w-full">
              <Folder className="mr-2 h-5 w-5" />
              Mở một dự án...
            </Button>
          </div>
          <div className="flex flex-col p-6 border rounded-lg">
            <h2 className="text-xl font-semibold mb-4 flex items-center justify-center">
              <History className="mr-2 h-5 w-5" />
              Dự án gần đây
            </h2>
            {recentPaths.length > 0 ? (
              <ScrollArea className="flex-1 h-48">
                <div className="space-y-2">
                  {recentPaths.map((path) => (
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
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Chưa có dự án nào được mở.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
