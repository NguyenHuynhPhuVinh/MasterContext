// src/components/Sidebar.tsx
import { FolderKanban, Shapes, Settings, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

// Tách các mục menu chính và phụ
const mainNavItems = [
  { key: "project", text: "Dự án", icon: FolderKanban, active: true },
  { key: "grouping", text: "Phân nhóm", icon: Shapes, active: false },
];

const secondaryNavItems = [
  { key: "settings", text: "Cài đặt", icon: Settings, active: false },
];

export function Sidebar() {
  return (
    // --- CẬP NHẬT: Thay đổi border-l thành border-r và sử dụng màu sidebar ---
    <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* 1. Header của Sidebar */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <a href="#" className="flex items-center gap-2 font-semibold">
          <LayoutDashboard className="h-6 w-6" />
          <span>Master Context</span>
        </a>
      </div>

      {/* 2. Container chính cho các menu, dùng flex-1 để nó lấp đầy không gian */}
      <div className="flex flex-1 flex-col justify-between overflow-y-auto">
        {/* Menu chính */}
        <nav className="flex-grow px-4 py-4">
          <ul className="flex flex-col gap-2">
            {mainNavItems.map((item) => (
              <li key={item.key}>
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    item.active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.text}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Menu phụ (ở dưới cùng) */}
        <nav className="mt-auto border-t border-sidebar-border px-4 py-4">
          <ul className="flex flex-col gap-2">
            {secondaryNavItems.map((item) => (
              <li key={item.key}>
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    item.active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.text}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
