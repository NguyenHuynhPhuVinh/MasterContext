// src/lib/treeUtils.ts
import type { FileNode } from "@/store/types";

export const getDescendantAndSelfPaths = (node: FileNode): string[] => {
  const paths = [node.path];
  if (Array.isArray(node.children)) {
    node.children.forEach((child) => {
      paths.push(...getDescendantAndSelfPaths(child));
    });
  }
  return paths;
};

export const areAllDescendantsSelected = (
  node: FileNode,
  selectedPaths: Set<string>
): boolean => {
  // Một node chỉ được coi là "chọn tất cả" nếu chính nó được chọn...
  if (!selectedPaths.has(node.path)) return false;
  // ...và tất cả các con của nó cũng được "chọn tất cả".
  if (Array.isArray(node.children)) {
    return node.children.every((child) =>
      areAllDescendantsSelected(child, selectedPaths)
    );
  }
  // Nếu là file, chỉ cần kiểm tra chính nó.
  return true;
};

// === BẮT ĐẦU PHẦN SỬA LỖI QUAN TRỌNG NHẤT ===
export const prunePathsForSave = (
  rootNode: FileNode,
  selectedPaths: Set<string>
): string[] => {
  const pruned: string[] = [];

  function traverse(node: FileNode) {
    // Trường hợp 1: Node là một thư mục và TẤT CẢ con cháu của nó được chọn.
    // Đây là điểm "tối ưu hóa" (pruning).
    if (
      Array.isArray(node.children) &&
      areAllDescendantsSelected(node, selectedPaths)
    ) {
      // Chúng ta chỉ cần thêm đường dẫn của thư mục này và không cần đi sâu hơn nữa.
      // Không thêm đường dẫn gốc "" rỗng vào danh sách cuối cùng.
      if (node.path !== "") {
        pruned.push(node.path);
      } else {
        // Xử lý trường hợp đặc biệt: Nếu toàn bộ dự án được chọn,
        // chúng ta vẫn cần duyệt các con trực tiếp của nó để có danh sách
        // cấp cao nhất (ví dụ: ["src", "public", "package.json"]).
        for (const child of node.children) {
          traverse(child);
        }
      }
      // Dừng việc duyệt nhánh này vì đã tối ưu hóa.
      return;
    }

    // Trường hợp 2: Node là một file và nó được chọn.
    if (!Array.isArray(node.children) && selectedPaths.has(node.path)) {
      pruned.push(node.path);
    }

    // Trường hợp 3: Node là một thư mục nhưng KHÔNG được chọn đầy đủ.
    // Chúng ta phải đi sâu vào bên trong để tìm các file/thư mục con được chọn.
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(rootNode);
  return pruned;
};
// === KẾT THÚC PHẦN SỬA LỖI QUAN TRỌNG NHẤT ===

export const expandPaths = (
  rootNode: FileNode,
  savedPaths: Set<string>
): Set<string> => {
  const expanded = new Set<string>();
  function traverse(node: FileNode, isAncestorSelected: boolean): boolean {
    let isSelected = isAncestorSelected || savedPaths.has(node.path);
    if (isSelected && Array.isArray(node.children)) {
      getDescendantAndSelfPaths(node).forEach((p) => expanded.add(p));
      return true;
    }
    if (isSelected) {
      expanded.add(node.path);
    }
    if (Array.isArray(node.children)) {
      let hasSelectedDescendant = false;
      for (const child of node.children) {
        if (traverse(child, isSelected)) {
          hasSelectedDescendant = true;
        }
      }
      if (hasSelectedDescendant) {
        expanded.add(node.path);
        return true;
      }
    }
    return expanded.has(node.path);
  }
  traverse(rootNode, false);
  return expanded;
};
