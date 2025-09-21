// src/App.tsx
import { useAppStore } from "./store/appStore";
import { WelcomeScene } from "./scenes/WelcomeScene";
import { DashboardScene } from "./scenes/DashboardScene"; // <-- Đổi tên import
import "./App.css";

function App() {
  const selectedPath = useAppStore((state) => state.selectedPath);

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground">
      {!selectedPath ? (
        <div className="flex flex-1 items-center justify-center">
          <WelcomeScene />
        </div>
      ) : (
        <DashboardScene /> // <-- Sử dụng Scene mới
      )}
    </div>
  );
}

export default App;
