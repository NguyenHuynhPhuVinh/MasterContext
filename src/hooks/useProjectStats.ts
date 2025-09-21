// src/hooks/useProjectStats.ts
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

// Interface mới khớp với struct Rust `ProjectStats`
export interface ProjectStats {
  total_files: number;
  total_dirs: number;
  total_size: number; // in bytes
  total_tokens: number; // <-- THÊM DÒNG NÀY
}

export function useProjectStats(path: string | null) {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setStats(null);
      return;
    }

    const loadStats = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // --- CẬP NHẬT: Gọi command mới `get_project_stats` ---
        const result = await invoke<ProjectStats>("get_project_stats", {
          path,
        });
        setStats(result);
      } catch (err) {
        console.error("Lỗi khi lấy thông tin dự án:", err);
        setError(
          typeof err === "string" ? err : "Không thể lấy thông tin dự án."
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [path]);

  return { stats, isLoading, error };
}
