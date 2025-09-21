// src/components/FileExplorer.tsx

import { Folder, File, ArrowLeft } from "lucide-react";
import { Button } from "./ui/button"; // Import Button

// Định nghĩa kiểu dữ liệu cho một mục trong thư mục, khớp với struct Rust
export interface DirEntry {
  name: string;
  is_directory: boolean;
}

interface FileExplorerProps {
  path: string;
  contents: DirEntry[];
  onBack: () => void;
  // --- THÊM MỚI ---
  onDirectoryClick: (name: string) => void; // Hàm xử lý khi click vào thư mục
  // --- KẾT THÚC THÊM MỚI ---
}

export function FileExplorer({
  path,
  contents,
  onBack,
  onDirectoryClick,
}: FileExplorerProps) {
  return (
    <div className="flex h-full w-full flex-col p-6">
      {/* Header */}
      <div className="mb-4 flex items-center gap-4">
        {/* Sử dụng Button của Shadcn cho nút Back */}
        <Button variant="outline" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Quay lại</span>
        </Button>
        <div>
          <h2 className="text-2xl font-bold">Nội dung thư mục</h2>
          <p className="break-all font-mono text-sm text-muted-foreground">
            {path}
          </p>
        </div>
      </div>

      {/* Danh sách file và thư mục */}
      <div className="flex-1 overflow-y-auto rounded-lg border">
        <ul className="divide-y divide-border">
          {contents.map((item) => (
            // --- CẬP NHẬT DÒNG NÀY ---
            <li
              key={item.name}
              // --- CẬP NHẬT: Dùng accent color của Shadcn cho hover ---
              className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                item.is_directory
                  ? "cursor-pointer hover:bg-accent hover:text-accent-foreground"
                  : "cursor-default"
              }`}
              onClick={() => item.is_directory && onDirectoryClick(item.name)}
            >
              {/* --- KẾT THÚC CẬP NHẬT --- */}
              {item.is_directory ? (
                <Folder className="h-5 w-5 text-blue-500" />
              ) : (
                <File className="h-5 w-5 text-muted-foreground" />
              )}
              <span className="text-sm">{item.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
