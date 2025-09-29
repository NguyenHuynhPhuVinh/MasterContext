// src/hooks/useSidebarPanel.ts
import { useDashboard } from "@/hooks/useDashboard";

export function useSidebarPanel() {
  const dashboard = useDashboard();

  return dashboard;
}
