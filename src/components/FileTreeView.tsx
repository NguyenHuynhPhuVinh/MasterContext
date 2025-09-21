// src/components/FileTreeView.tsx
import { useState } from "react";
import { ChevronRight, Folder, File as FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Định nghĩa lại interface ở đây để component có thể tự chứa
export interface FileNode {
  name: string;
  path: string;
  children?: FileNode[] | null; // <-- Cập nhật type để khớp với JSON từ Rust
}

interface FileTreeViewProps {
  node: FileNode;
  selectedPaths: Set<string>;
  onToggle: (
    path: string,
    isSelected: boolean,
    children?: FileNode[] | null
  ) => void;
  level?: number;
}

export function FileTreeView({
  node,
  selectedPaths,
  onToggle,
  level = 0,
}: FileTreeViewProps) {
  // --- BẮT ĐẦU SỬA LỖI ---
  // Thay đổi cách kiểm tra thư mục để chính xác hơn
  const isDirectory = Array.isArray(node.children);
  // --- KẾT THÚC SỬA LỖI ---

  const [isOpen, setIsOpen] = useState(level < 2); // Mở sẵn 2 cấp đầu

  const isSelected = selectedPaths.has(node.path);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onToggle(node.path, e.target.checked, node.children);
  };

  const handleToggleDirectory = () => {
    if (isDirectory) setIsOpen(!isOpen);
  };

  return (
    <div>
      <div
        className="flex items-center py-1 px-2 rounded-md hover:bg-accent cursor-pointer"
        style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
        onClick={handleToggleDirectory}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleCheckboxChange}
          onClick={(e) => e.stopPropagation()} // Ngăn việc click checkbox làm đóng/mở thư mục
          className="mr-2 h-4 w-4"
        />
        {isDirectory ? (
          <>
            <ChevronRight
              className={cn(
                "h-4 w-4 mr-1 shrink-0 transition-transform duration-200",
                isOpen && "rotate-90"
              )}
            />
            <Folder className="h-4 w-4 mr-2 text-yellow-500" />
          </>
        ) : (
          <FileIcon className="h-4 w-4 mr-2 text-blue-500" />
        )}
        <span>{node.name}</span>
      </div>
      {isDirectory && isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeView
              key={child.path}
              node={child}
              selectedPaths={selectedPaths}
              onToggle={onToggle}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
