// src/App.tsx
import { useAppStore } from "./store/appStore";
import { WelcomeScene } from "./scenes/WelcomeScene";
import { ExplorerScene } from "./scenes/ExplorerScene";
import "./App.css";

function App() {
  const selectedPath = useAppStore((state) => state.selectedPath);

  return (
    // --- CẬP NHẬT: Thêm w-screen và loại bỏ items-center, justify-center ---
    <div className="h-screen w-screen flex flex-col bg-background text-foreground">
      {!selectedPath ? (
        // Thêm một div để căn giữa WelcomeScene
        <div className="flex flex-1 items-center justify-center">
          <WelcomeScene />
        </div>
      ) : (
        <ExplorerScene />
      )}
    </div>
  );
}

export default App;
