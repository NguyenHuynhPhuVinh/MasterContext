// src/scenes/WelcomeScene.tsx
import { Folder } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppActions } from "@/store/appStore";
import { Button } from "@/components/ui/button"; // <-- Import Button từ Shadcn

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
      {/* --- CẬP NHẬT: Thay thế <button> bằng <Button> --- */}
      <Button size="lg" onClick={handleSelectFolder}>
        <Folder className="mr-2 h-6 w-6" />
        Chọn Thư Mục
      </Button>
    </main>
  );
}
