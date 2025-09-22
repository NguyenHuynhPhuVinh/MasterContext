// src/lib/treeUtils.ts
import type { FileNode } from "@/store/types";

/**
 * Lấy tất cả đường dẫn của chính node và các con cháu của nó.
 * @param node - Node bắt đầu.
 * @returns Mảng các chuỗi đường dẫn.
 */
export const getDescendantAndSelfPaths = (node: FileNode): string[] => {
  const paths = [node.path];
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      paths.push(...getDescendantAndSelfPaths(child));
    }
  }
  return paths;
};

/**
 * Tối ưu hóa danh sách các đường dẫn đã chọn thành một danh sách tối thiểu để lưu.
 * Nếu một thư mục được chọn hoàn toàn, chỉ đường dẫn thư mục đó được giữ lại.
 * Nếu một thư mục chỉ được chọn một phần, hàm sẽ đi sâu vào trong.
 * @param node - Node gốc của cây thư mục.
 * @param selectedPaths - Set chứa tất cả các đường dẫn được chọn trên UI (đã mở rộng).
 * @returns Mảng các đường dẫn đã được tối ưu hóa.
 */
export const prunePathsForSave = (
  node: FileNode,
  selectedPaths: Set<string>
): string[] => {
  const prunedPaths: string[] = [];

  // Hàm đệ quy để duyệt cây
  function traverse(currentNode: FileNode) {
    // Bỏ qua nếu node này không được chọn và không phải là thư mục gốc
    if (!selectedPaths.has(currentNode.path) && currentNode.path !== "") {
      return;
    }

    // Trường hợp 1: Node là một file. Nếu được chọn, thêm nó vào.
    if (
      !Array.isArray(currentNode.children) ||
      currentNode.children.length === 0
    ) {
      if (selectedPaths.has(currentNode.path)) {
        prunedPaths.push(currentNode.path);
      }
      return;
    }

    // Trường hợp 2: Node là một thư mục.
    const descendantPaths = getDescendantAndSelfPaths(currentNode);
    // Kiểm tra xem TẤT CẢ các con cháu (và chính nó) có nằm trong selectedPaths không.
    const isFullySelected = descendantPaths.every((p) => selectedPaths.has(p));

    if (isFullySelected) {
      // Nếu được chọn hoàn toàn, chỉ cần thêm đường dẫn của thư mục này và dừng lại.
      // Không thêm đường dẫn gốc rỗng vào kết quả cuối cùng.
      if (currentNode.path !== "") {
        prunedPaths.push(currentNode.path);
      } else {
        // Trường hợp đặc biệt: Nếu TOÀN BỘ dự án được chọn, chúng ta cần duyệt
        // các con cấp 1 của nó để trả về danh sách ["src", "public", ...]
        for (const child of currentNode.children ?? []) {
          traverse(child);
        }
      }
    } else {
      // Nếu chỉ được chọn một phần, phải đi sâu vào từng con để kiểm tra.
      for (const child of currentNode.children ?? []) {
        traverse(child);
      }
    }
  }

  traverse(node);
  return prunedPaths;
};

/**
 * Mở rộng một danh sách đường dẫn tối thiểu (đã lưu) thành một Set đầy đủ để hiển thị trên UI.
 * @param rootNode - Node gốc của cây thư mục.
 * @param savedPaths - Set chứa các đường dẫn đã được tối ưu hóa.
 * @returns Set chứa tất cả các đường dẫn cần được check trên UI.
 */
export const expandPaths = (
  rootNode: FileNode,
  savedPaths: Set<string>
): Set<string> => {
  const expanded = new Set<string>();

  function traverse(node: FileNode) {
    // Nếu đường dẫn của node này nằm trong danh sách đã lưu,
    // thêm nó và tất cả các con cháu của nó vào set mở rộng.
    if (savedPaths.has(node.path)) {
      getDescendantAndSelfPaths(node).forEach((p) => expanded.add(p));
      // Vì đã thêm tất cả, không cần đi sâu hơn nữa từ node này.
      return;
    }

    // Nếu không, tiếp tục duyệt các con của nó.
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  // Luôn bắt đầu từ gốc
  traverse(rootNode);

  // Sau khi mở rộng, phải thêm các thư mục cha ngược lên đến gốc
  // để đảm bảo UI hiển thị đúng (VD: checkbox indeterminate).
  const pathsToAddParentsFor = [...expanded];
  for (const path of pathsToAddParentsFor) {
    let current = path;
    while (current.includes("/")) {
      current = current.substring(0, current.lastIndexOf("/"));
      if (current) {
        // Chỉ thêm nếu không phải chuỗi rỗng
        expanded.add(current);
      }
    }
  }
  // Luôn thêm đường dẫn gốc
  expanded.add("");

  return expanded;
};
