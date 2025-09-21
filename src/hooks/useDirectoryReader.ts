// src/hooks/useDirectoryReader.ts
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DirEntry } from "@/components/FileExplorer";

export function useDirectoryReader(path: string | null) {
  const [contents, setContents] = useState<DirEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [path]); // Chạy lại effect này mỗi khi `path` thay đổi

  return { contents, isLoading, error };
}
