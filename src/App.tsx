// src/App.tsx

import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { join, dirname } from "@tauri-apps/api/path"; // Import hàm xử lý đường dẫn
import { Folder } from "lucide-react";
import { FileExplorer, type DirEntry } from "./components/FileExplorer"; // Import component mới
import "./App.css";

function App() {
  // `rootPath` lưu thư mục gốc được chọn ban đầu
  const [rootPath, setRootPath] = useState<string | null>(null);
  // `selectedPath` lưu thư mục đang được hiển thị
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const [directoryContents, setDirectoryContents] = useState<DirEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDirectoryContents = async (path: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<DirEntry[]>("read_directory", { path });
      setDirectoryContents(result);
    } catch (err) {
      console.error("Lỗi khi đọc thư mục:", err);
      setError(
        typeof err === "string" ? err : "Không thể đọc nội dung thư mục."
      );
      setTimeout(() => {
        setSelectedPath(null);
        setError(null);
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const result = await open({
        directory: true,
        multiple: false,
        title: "Chọn một thư mục dự án",
      });

      if (typeof result === "string") {
        setRootPath(result); // Đặt đường dẫn gốc
        setSelectedPath(result); // Đặt đường dẫn hiện tại
        loadDirectoryContents(result);
      }
    } catch (error) {
      console.error("Lỗi khi chọn thư mục:", error);
    }
  };

  // --- HÀM MỚI: Xử lý điều hướng vào thư mục con ---
  const handleNavigateInto = async (dirName: string) => {
    if (!selectedPath) return;
    // Dùng `join` để tạo đường dẫn mới một cách an toàn (cross-platform)
    const newPath = await join(selectedPath, dirName);
    setSelectedPath(newPath);
    loadDirectoryContents(newPath);
  };

  // --- CẬP NHẬT: Xử lý quay lại một cấp ---
  const handleGoBack = async () => {
    if (!selectedPath || !rootPath) return;

    // Nếu đang ở thư mục gốc, quay về màn hình chào mừng
    if (selectedPath === rootPath) {
      setRootPath(null);
      setSelectedPath(null);
      setDirectoryContents([]);
    } else {
      // Nếu không, đi lên thư mục cha
      const parentPath = await dirname(selectedPath);
      setSelectedPath(parentPath);
      loadDirectoryContents(parentPath);
    }
  };

  // Giao diện chào mừng ban đầu
  const WelcomeScreen = () => (
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

  // Giao diện hiển thị danh sách file
  const ExplorerView = () => {
    if (isLoading) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-lg text-muted-foreground">Đang tải...</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-lg text-destructive">{error}</p>
        </div>
      );
    }
    if (selectedPath) {
      return (
        <FileExplorer
          path={selectedPath}
          contents={directoryContents}
          onBack={handleGoBack}
          onDirectoryClick={handleNavigateInto} // Truyền hàm mới vào component con
        />
      );
    }
    return null;
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      {!selectedPath ? <WelcomeScreen /> : <ExplorerView />}
    </div>
  );
}

export default App;
