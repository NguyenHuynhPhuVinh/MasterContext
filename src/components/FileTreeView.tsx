// src/components/FileTreeView.tsx
import { useState, useEffect, useRef } from "react"; // <-- Thêm useEffect, useRef
import { ChevronRight, Folder, File as FileIcon, Scissors } from "lucide-react";
import { useAppActions, useAppStore } from "@/store/appStore";
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
  gitStatus: Record<string, string> | null;
  level?: number;
}

export function FileTreeView({
  node,
  selectedPaths,
  onToggle,
  gitStatus,
  level = 0,
}: FileTreeViewProps) {
  const { openFileInEditor } = useAppActions();
  const fileMetadataCache = useAppStore((state) => state.fileMetadataCache);
  const checkboxRef = useRef<HTMLInputElement>(null);
  const isDirectory = Array.isArray(node.children);
  const [isOpen, setIsOpen] = useState(level < 2);
  const fileGitStatus = gitStatus?.[node.path];

  const getStatusColor = (status: string | undefined) => {
    if (!status) return "";
    if (status.includes("M")) return "text-blue-500 dark:text-blue-400";
    if (status.includes("A")) return "text-green-500 dark:text-green-400";
    if (status.includes("D")) return "text-red-500 dark:text-red-400";
    if (status.includes("R")) return "text-purple-500 dark:text-purple-400";
    return "text-orange-500 dark:text-orange-400"; // for C, ?? and other cases
  };

  const hasExclusions =
    !isDirectory &&
    fileMetadataCache &&
    node.path in fileMetadataCache &&
    (fileMetadataCache[node.path]?.excluded_ranges?.length ?? 0) > 0;

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

  const handleItemClick = () => {
    if (isDirectory) {
      setIsOpen(!isOpen);
    } else {
      openFileInEditor(node.path);
    }
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
          onClick={handleItemClick}
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
            <>
              <FileIcon className="h-4 w-4 mr-2 text-blue-500 shrink-0" />
              {hasExclusions && (
                <Scissors className="h-3.5 w-3.5 text-destructive shrink-0" />
              )}
            </>
          )}
          <span className="ml-2 truncate">{node.name}</span>
          {fileGitStatus && (
            <span
              className={cn(
                "ml-auto font-mono text-xs font-bold",
                getStatusColor(fileGitStatus)
              )}
              title={`Git Status: ${fileGitStatus}`}
            >
              {fileGitStatus}
            </span>
          )}
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
              gitStatus={gitStatus}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
