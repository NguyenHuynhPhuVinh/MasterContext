// src/hooks/useSidebarPanel.ts
import { useState, useEffect } from "react";
import { useDashboard } from "@/hooks/useDashboard";

export function useSidebarPanel() {
  const dashboard = useDashboard();
  const { activeProfile } = dashboard;

  const [expandedProfiles, setExpandedProfiles] = useState<
    Record<string, boolean>
  >({ [activeProfile]: true });

  const toggleProfileExpansion = (e: React.MouseEvent, profileName: string) => {
    e.stopPropagation();
    setExpandedProfiles((prev) => ({
      ...prev,
      [profileName]: !prev[profileName],
    }));
  };

  // Effect to automatically expand the active profile when it changes
  useEffect(() => {
    setExpandedProfiles((prev) => ({ ...prev, [activeProfile]: true }));
  }, [activeProfile]);

  return {
    ...dashboard,
    expandedProfiles,
    toggleProfileExpansion,
  };
}
