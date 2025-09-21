import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Folder } from "lucide-react";
import "./App.css";

function App() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  // Hàm xử lý việc mở hộp thoại chọn thư mục
  const handleSelectFolder = async () => {
    try {
      const result = await open({
        directory: true, // Chỉ cho phép chọn thư mục
        multiple: false, // Chỉ cho phép chọn một thư mục
        title: "Chọn một thư mục dự án",
      });

      if (typeof result === "string") {
        setSelectedPath(result);
      }
    } catch (error) {
      console.error("Lỗi khi chọn thư mục:", error);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Nội dung chính */}
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
        <h1 className="text-4xl font-bold">Master Context</h1>
        <p className="text-sm text-muted-foreground">
          Công cụ quản lý và tạo ngữ cảnh cho dự án của bạn.
        </p>

        {/* Nút chọn thư mục */}
        <button
          onClick={handleSelectFolder}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Folder className="h-6 w-6" />
          <span>Chọn Thư Mục</span>
        </button>

        {/* Hiển thị đường dẫn đã chọn */}
        {selectedPath && (
          <div className="mt-6 w-full max-w-xl">
            <p className="text-sm text-muted-foreground">Thư mục đã chọn:</p>
            <p className="mt-1 break-all rounded-md bg-muted p-3 font-mono text-sm text-muted-foreground">
              {selectedPath}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
