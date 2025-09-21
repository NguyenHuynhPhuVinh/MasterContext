// src/App.tsx
import { useAppStore } from "./store/appStore";
import { WelcomeScene } from "./scenes/WelcomeScene";
import { DashboardScene } from "./scenes/DashboardScene";
import { GroupEditorScene } from "./scenes/GroupEditorScene"; // <-- Import scene mới
import "./App.css";

function App() {
  const selectedPath = useAppStore((state) => state.selectedPath);
  const activeScene = useAppStore((state) => state.activeScene);

  const renderContent = () => {
    if (!selectedPath) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <WelcomeScene />
        </div>
      );
    }
    // Dựa vào activeScene để render component tương ứng
    switch (activeScene) {
      case "groupEditor":
        return <GroupEditorScene />;
      case "dashboard":
      default:
        return <DashboardScene />;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground">
      {renderContent()}
    </div>
  );
}

export default App;
