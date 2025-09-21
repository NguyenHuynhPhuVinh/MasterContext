// src/components/FileTreeView.tsx
import { useState, useEffect, useRef } from "react"; // <-- Thêm useEffect, useRef
import { ChevronRight, Folder, File as FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileNode {
  name: string;
  path: string;
  children?: FileNode[] | null;
}

// --- HÀM HELPER: Lấy tất cả đường dẫn con cháu ---
const getDescendantPaths = (node: FileNode): string[] => {
  if (!Array.isArray(node.children)) return [];
  return node.children.flatMap((child) => [
    child.path,
    ...getDescendantPaths(child),
  ]);
};

// --- HÀM HELPER: Xác định trạng thái lựa chọn của một node ---
const getNodeSelectionState = (
  node: FileNode,
  selectedPaths: Set<string>
): "checked" | "unchecked" | "indeterminate" => {
  if (!Array.isArray(node.children)) {
    return selectedPaths.has(node.path) ? "checked" : "unchecked";
  }

  const descendantPaths = getDescendantPaths(node);
  const selectedDescendants = descendantPaths.filter((p) =>
    selectedPaths.has(p)
  );

  if (selectedDescendants.length === 0) {
    return "unchecked";
  }
  if (
    selectedDescendants.length === descendantPaths.length &&
    selectedPaths.has(node.path)
  ) {
    return "checked";
  }
  return "indeterminate";
};

interface FileTreeViewProps {
  node: FileNode;
  selectedPaths: Set<string>;
  onToggle: (node: FileNode, isSelected: boolean) => void; // <-- Sửa prop để truyền cả node
  level?: number;
}

export function FileTreeView({
  node,
  selectedPaths,
  onToggle,
  level = 0,
}: FileTreeViewProps) {
  const checkboxRef = useRef<HTMLInputElement>(null);
  const isDirectory = Array.isArray(node.children);
  const [isOpen, setIsOpen] = useState(level < 2);

  const selectionState = isDirectory
    ? getNodeSelectionState(node, selectedPaths)
    : selectedPaths.has(node.path)
    ? "checked"
    : "unchecked";

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = selectionState === "indeterminate";
    }
  }, [selectionState]);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onToggle(node, e.target.checked);
  };

  const handleToggleDirectory = () => {
    if (isDirectory) setIsOpen(!isOpen);
  };

  return (
    <div>
      <div
        className="flex items-center py-1 px-2 rounded-md hover:bg-accent"
        style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
      >
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={selectionState === "checked"}
          onChange={handleCheckboxChange}
          onClick={(e) => e.stopPropagation()}
          className="mr-2 h-4 w-4"
        />
        <div
          onClick={handleToggleDirectory}
          className="flex items-center cursor-pointer flex-grow"
        >
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
