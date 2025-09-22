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
    if (!selectedPaths.has(node.path)) return;
    if (areAllDescendantsSelected(node, selectedPaths)) {
      pruned.push(node.path);
      return;
    }
    if (!Array.isArray(node.children) && selectedPaths.has(node.path)) {
      pruned.push(node.path);
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }
  if (Array.isArray(rootNode.children)) {
    for (const child of rootNode.children) {
      traverse(child);
    }
  }
  // Xử lý trường hợp chỉ có thư mục gốc được chọn
  if (
    pruned.length === 0 &&
    selectedPaths.has(rootNode.path) &&
    areAllDescendantsSelected(rootNode, selectedPaths)
  ) {
    pruned.push(rootNode.path);
  }
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
