// src/components/FileExplorer.tsx

import { Folder, File, ArrowLeft } from "lucide-react";

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
    <div className="flex w-full max-w-4xl flex-1 flex-col p-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center justify-center rounded-md p-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Quay lại"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold">Nội dung thư mục</h2>
          <p className="break-all font-mono text-sm text-muted-foreground">
            {path}
          </p>
        </div>
      </div>

      {/* Danh sách file và thư mục */}
      <div className="flex-1 overflow-y-auto rounded-lg border bg-card">
        <ul className="divide-y divide-border">
          {contents.map((item) => (
            // --- CẬP NHẬT DÒNG NÀY ---
            <li
              key={item.name}
              className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                item.is_directory
                  ? "cursor-pointer hover:bg-muted/50"
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
              <span className="text-sm text-card-foreground">{item.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
