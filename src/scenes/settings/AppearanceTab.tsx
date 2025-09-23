// src/scenes/settings/AppearanceTab.tsx
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppearanceTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Cài đặt Giao diện</h2>
      <div className="flex items-center justify-between rounded-lg border p-4">
        <Label htmlFor="theme-toggle" className="text-base">
          Chủ đề (Sáng/Tối)
        </Label>
        <ThemeToggle />
      </div>
    </div>
  );
}
