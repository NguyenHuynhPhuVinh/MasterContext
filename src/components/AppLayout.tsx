// src/components/AppLayout.tsx
import React from "react";
import { Sidebar } from "./Sidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex h-full w-full">
      {/* --- CẬP NHẬT: Đưa Sidebar lên trước --- */}
      <Sidebar />

      {/* Phần nội dung chính, vẫn chiếm phần lớn không gian */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
