// src/hooks/useDirectoryReader.ts
import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";

// Định nghĩa lại interface ở đây để hook tự quản lý
interface DirEntry {
  name: string;
  is_directory: boolean;
}

export function useDirectoryReader(path: string | null) {
  const [contents, setContents] = useState<DirEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ... (phần useEffect giữ nguyên)
    if (!path) {
      setContents([]);
      return;
    }
    const loadContents = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await invoke<DirEntry[]>("read_directory", { path });
        setContents(result);
      } catch (err) {
        console.error("Lỗi khi đọc thư mục:", err);
        setError(
          typeof err === "string" ? err : "Không thể đọc nội dung thư mục."
        );
      } finally {
        setIsLoading(false);
      }
    };
    loadContents();
  }, [path]);

  // --- PHẦN MỚI: Tính toán thống kê ---
  const stats = useMemo(() => {
    const fileCount = contents.filter((item) => !item.is_directory).length;
    const directoryCount = contents.length - fileCount;
    return { fileCount, directoryCount };
  }, [contents]);

  return { contents, isLoading, error, ...stats };
}
