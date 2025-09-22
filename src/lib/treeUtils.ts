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
  if (!selectedPaths.has(node.path)) return false;
  if (Array.isArray(node.children)) {
    return node.children.every((child) =>
      areAllDescendantsSelected(child, selectedPaths)
    );
  }
  return true;
};

export const prunePathsForSave = (
  rootNode: FileNode,
  selectedPaths: Set<string>
): string[] => {
  const pruned: string[] = [];

  function traverse(node: FileNode) {
    // *** PHẦN SỬA LỖI QUAN TRỌNG ***
    // Logic mới không dừng lại ngay cả khi node hiện tại không được chọn,
    // vì một trong các con của nó có thể được chọn.

    // Nếu node này được chọn và TẤT CẢ các con cháu của nó cũng được chọn,
    // đây là điểm "tối ưu". Ta chỉ cần thêm node này và không cần đi sâu hơn.
    if (
      selectedPaths.has(node.path) &&
      areAllDescendantsSelected(node, selectedPaths)
    ) {
      // Không thêm đường dẫn gốc "" vào danh sách lưu
      if (node.path !== "") {
        pruned.push(node.path);
      }
      // Nếu node gốc được chọn toàn bộ, vẫn cần duyệt con của nó
      if (node.path === "" && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child);
        }
      }
      return;
    }

    // Nếu node là một file và được chọn
    if (!Array.isArray(node.children) && selectedPaths.has(node.path)) {
      pruned.push(node.path);
    }

    // Nếu là thư mục, luôn luôn duyệt các con của nó.
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(rootNode);
  return pruned;
};

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
