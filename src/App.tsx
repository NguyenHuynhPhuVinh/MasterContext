// src/App.tsx
import { useAppStore } from "./store/appStore";
import { WelcomeScene } from "./scenes/WelcomeScene";
import { ExplorerScene } from "./scenes/ExplorerScene";
import "./App.css";

function App() {
  const selectedPath = useAppStore((state) => state.selectedPath);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      {!selectedPath ? <WelcomeScene /> : <ExplorerScene />}
    </div>
  );
}

export default App;
