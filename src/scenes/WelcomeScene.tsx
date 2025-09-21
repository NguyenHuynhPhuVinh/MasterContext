// src/scenes/WelcomeScene.tsx
import { Folder } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppActions } from "@/store/appStore";

export function WelcomeScene() {
  const { selectRootPath } = useAppActions();

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
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-bold">Master Context</h1>
      <p className="text-sm text-muted-foreground">
        Công cụ quản lý và tạo ngữ cảnh cho dự án của bạn.
      </p>
      <button
        onClick={handleSelectFolder}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Folder className="h-6 w-6" />
        <span>Chọn Thư Mục</span>
      </button>
    </main>
  );
}
