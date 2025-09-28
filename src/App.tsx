// src/App.tsx
import { useEffect, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import {
  Menu,
  MenuItem,
  Submenu,
  PredefinedMenuItem,
  CheckMenuItem,
} from "@tauri-apps/api/menu";
import { save, message } from "@tauri-apps/plugin-dialog"; // <-- THAY ĐỔI IMPORT
import { invoke } from "@tauri-apps/api/core";
import axios from "axios";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { useAppStore, useAppActions } from "./store/appStore";
import {
  type GroupStats,
  type AppSettings,
  type ScanCompletePayload,
  type AIModel,
} from "./store/types";
import { useShallow } from "zustand/react/shallow"; // <-- THÊM IMPORT NÀY
import { WelcomeScene } from "./scenes/WelcomeScene";
import { ScanningScene } from "./scenes/ScanningScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { SidebarPanel } from "./scenes/SidebarPanel";
import { GitPanel } from "./components/GitPanel";
import { AIPanel } from "./components/AIPanel"; // THÊM IMPORT
import { MainPanel } from "./scenes/MainPanel";
import { StatusBar } from "./components/StatusBar";
import { RescanIndicator } from "./components/RescanIndicator";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "./components/ui/resizable";
import { throttle } from "@/lib/utils";
import "./App.css";

function App() {
  const {
    selectedPath,
    activeScene,
    isScanning,
    isRescanning,
    projectStats,
    isSidebarVisible,
    isEditorPanelVisible,
    isGitPanelVisible,
    gitRepoInfo,
    isGroupEditorPanelVisible,
    isAiPanelVisible,
  } = useAppStore(
    // --- SỬA LỖI TẠI ĐÂY ---
    useShallow((state) => ({
      selectedPath: state.selectedPath,
      activeScene: state.activeScene,
      isScanning: state.isScanning,
      isRescanning: state.isRescanning,
      projectStats: state.projectStats,
      isSidebarVisible: state.isSidebarVisible,
      isGitPanelVisible: state.isGitPanelVisible,
      isEditorPanelVisible: state.isEditorPanelVisible,
      gitRepoInfo: state.gitRepoInfo,
      isGroupEditorPanelVisible: state.isGroupEditorPanelVisible,
      isAiPanelVisible: state.isAiPanelVisible, // THÊM STATE
    }))
  );

  const {
    _setScanProgress,
    _setAnalysisProgress,
    _setScanComplete,
    _setScanError,
    _setGroupUpdateComplete,
    rescanProject,
    openFolderFromMenu,
    showSettingsScene,
    exportProject,
    copyProjectToClipboard,
    toggleProjectPanelVisibility,
    toggleGitPanelVisibility,
    toggleEditorPanelVisibility,
    _setRecentPaths,
    updateAppSettings,
    reset,
    toggleGroupEditorPanelVisibility,
    toggleAiPanelVisibility, // THÊM ACTION
  } = useAppActions();

  const { t } = useTranslation();

  // --- Effect áp dụng theme (giữ nguyên) ---
  useEffect(() => {
    const theme = localStorage.getItem("theme") || "light";
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, []);

  // Effect to manage syntax highlighting theme
  useEffect(() => {
    const linkId = "hljs-theme";
    let link = document.getElementById(linkId) as HTMLLinkElement;

    if (!link) {
      link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }

    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains("dark");
      link.href = isDark
        ? "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css"
        : "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css";
    };

    updateTheme(); // Set initial theme

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // Load app settings on startup
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await invoke<AppSettings>("get_app_settings");
        // Cập nhật state một lần với tất cả cài đặt
        _setRecentPaths(settings.recentPaths ?? []);

        const googleModels: AIModel[] = [
          {
            provider: "google",
            id: "gemini-flash-latest",
            name: "Gemini 2.5 Flash",
            context_length: 1048576,
            pricing: { prompt: "0", completion: "0" },
          },
          {
            provider: "google",
            id: "gemini-flash-lite-latest",
            name: "Gemini 2.5 Flash Lite",
            context_length: 1048576,
            pricing: { prompt: "0", completion: "0" },
          },
          {
            provider: "google",
            id: "gemini-2.5-pro",
            name: "Gemini 2.5 Pro",
            context_length: 1048576,
            pricing: { prompt: "0", completion: "0" },
          },
          {
            provider: "google",
            id: "gemini-robotics-er-1.5-preview",
            name: "Gemini Robotics ER 1.5 Preview",
            context_length: 1048576,
            pricing: { prompt: "0", completion: "0" },
          },
          {
            provider: "google",
            id: "gemini-2.0-flash",
            name: "Gemini 2.0 Flash",
            context_length: 1048576,
            pricing: { prompt: "0", completion: "0" },
          },
          {
            provider: "google",
            id: "gemini-2.0-flash-lite",
            name: "Gemini 2.0 Flash Lite",
            context_length: 1048576,
            pricing: { prompt: "0", completion: "0" },
          },
        ];

        let allAvailableModels: AIModel[] = [...googleModels];

        // Fetch all models from OpenRouter
        try {
          const response = await axios.get(
            "https://openrouter.ai/api/v1/models"
          );
          const allModelsData: any[] = response.data.data;
          const openRouterModels: AIModel[] = allModelsData.map((m: any) => ({
            provider: "openrouter",
            id: m.id,
            name: m.name,
            context_length: m.context_length,
            pricing: {
              prompt: m.pricing.prompt,
              completion: m.pricing.completion,
            },
          }));
          allAvailableModels.push(...openRouterModels);
        } catch (e) {
          console.warn("Could not fetch OpenRouter models", e);
        }

        const savedModelIds = settings.aiModels ?? ["gemini-flash-latest"];

        const projectAiModels: AIModel[] = savedModelIds
          .map((id) => allAvailableModels.find((m) => m.id === id))
          .filter((m): m is AIModel => !!m);

        // Dùng set thay vì updateAppSettings để không ghi lại file
        useAppStore.setState({
          nonAnalyzableExtensions: settings.nonAnalyzableExtensions ?? [],
          openRouterApiKey: settings.openRouterApiKey ?? "",
          googleApiKey: settings.googleApiKey ?? "",
          allAvailableModels,
          aiModels: projectAiModels.length
            ? projectAiModels
            : [
                allAvailableModels.find((m) => m.id === "gemini-flash-latest")!,
              ].filter(Boolean),
          selectedAiModel:
            projectAiModels.find(
              (m) => m.id === useAppStore.getState().selectedAiModel
            )?.id ||
            projectAiModels[0]?.id ||
            "gemini-flash-latest",
        });
      } catch (e) {
        console.error("Could not load app settings:", e);
      }
    };
    loadSettings();
  }, [_setRecentPaths]);

  // --- CẬP NHẬT LOGIC TẠO MENU ---
  // Effect này sẽ chạy mỗi khi `selectedPath` hoặc `isScanning` thay đổi
  useEffect(() => {
    const setupMenu = async () => {
      try {
        const openFolderItem = await MenuItem.new({
          id: "open_new_folder",
          text: t("appMenu.file.openNew"),
          action: openFolderFromMenu,
        });

        const rescanFolderItem = await MenuItem.new({
          id: "rescan_folder",
          text: t("appMenu.file.rescan"),
          enabled: !isRescanning,
          action: async () => {
            if (useAppStore.getState().selectedPath) {
              rescanProject();
            } else {
              await message("Vui lòng mở một dự án trước khi quét lại.", {
                title: "Thông báo",
                kind: "info",
              });
            }
          },
        });

        // --- TẠO CÁC MENU ITEM MỚI ---
        const exportProjectItem = await MenuItem.new({
          id: "export_project",
          text: t("appMenu.file.exportProject"),
          action: exportProject,
        });

        const copyProjectItem = await MenuItem.new({
          id: "copy_project",
          text: t("appMenu.file.copyProject"),
          action: copyProjectToClipboard,
        });

        const closeProjectItem = await MenuItem.new({
          id: "close_project",
          text: t("appMenu.file.closeProject"),
          action: reset,
        });

        const fileSubmenu = await Submenu.new({
          text: t("appMenu.file.title"),
          items: [
            openFolderItem,
            rescanFolderItem,
            exportProjectItem,
            copyProjectItem,
            await PredefinedMenuItem.new({ item: "Separator" }),
            closeProjectItem,
          ],
        });

        // --- MENU MỚI ---
        const windowSubmenu = await Submenu.new({
          text: t("appMenu.window.title"),
          items: [
            await CheckMenuItem.new({
              id: "toggle_project_panel",
              text: t("appMenu.window.projectPanel"),
              action: toggleProjectPanelVisibility,
              checked: isSidebarVisible,
            }),
            await CheckMenuItem.new({
              id: "toggle_git_panel",
              text: t("appMenu.window.gitPanel"),
              action: toggleGitPanelVisibility,
              checked: isGitPanelVisible,
            }),
            await CheckMenuItem.new({
              id: "toggle_group_editor_panel",
              text: t("appMenu.window.groupEditorPanel"),
              action: toggleGroupEditorPanelVisibility,
              checked: isGroupEditorPanelVisible,
            }),
            await CheckMenuItem.new({
              id: "toggle_editor_panel",
              text: t("appMenu.window.editorPanel"),
              action: toggleEditorPanelVisibility,
              checked: isEditorPanelVisible,
            }),
            await CheckMenuItem.new({
              id: "toggle_ai_panel",
              text: t("appMenu.window.aiPanel"), // THÊM DÒNG NÀY
              action: toggleAiPanelVisibility,
              checked: isAiPanelVisible,
            }),
          ],
        });

        const appMenu = await Menu.new({
          items: [fileSubmenu, windowSubmenu],
        });

        // Đặt menu cho cửa sổ hiện tại
        await appMenu.setAsAppMenu();
      } catch (error) {
        console.error("Failed to create application menu:", error);
        await message(t("appMenu.errors.initFailed"), {
          title: t("appMenu.errors.criticalError"),
          kind: "error",
        });
      }
    };

    const clearMenu = async () => {
      try {
        // Tạo menu rỗng để gỡ bỏ menu
        const emptyMenu = await Menu.new({
          items: [],
        });
        await emptyMenu.setAsAppMenu();
      } catch (error) {
        console.error("Failed to clear application menu:", error);
      }
    };

    // Logic chính:
    // Nếu có selectedPath VÀ không đang quét, thì tạo menu
    if (selectedPath && !isScanning) {
      // <-- THAY ĐỔI ĐIỀU KIỆN TẠI ĐÂY
      setupMenu();
    } else {
      // Nếu không có (đang ở Welcome hoặc đang quét), thì gỡ menu
      clearMenu();
    }
  }, [
    // CẬP NHẬT DEPENDENCY ĐỂ MENU TỰ ĐỘNG CẬP NHẬT
    selectedPath,
    isScanning, // <-- THÊM VÀO DEPENDENCY
    isRescanning,
    isSidebarVisible,
    isGitPanelVisible,
    isEditorPanelVisible,
    isAiPanelVisible,
    isGroupEditorPanelVisible,
    openFolderFromMenu,
    rescanProject,
    showSettingsScene,
    exportProject,
    copyProjectToClipboard,
    toggleProjectPanelVisibility,
    toggleGitPanelVisibility,
    t,
    toggleEditorPanelVisibility,
    toggleGroupEditorPanelVisibility,
    isAiPanelVisible, // THÊM STATE
    toggleAiPanelVisibility, // THÊM ACTION
    _setRecentPaths,
    reset,
  ]); // <-- Thêm dependency

  const throttledSetScanProgress = useMemo(
    () => throttle((file: string) => _setScanProgress(file), 10),
    [_setScanProgress]
  );
  const throttledSetAnalysisProgress = useMemo(
    () => throttle((file: string) => _setAnalysisProgress(file), 10),
    [_setAnalysisProgress]
  );

  // --- LẮNG NGHE SỰ KIỆN TỪ RUST ---
  useEffect(() => {
    const unlistenFuncs: Promise<() => void>[] = [];

    unlistenFuncs.push(
      listen<string>("scan_progress", (event) => {
        throttledSetScanProgress(event.payload);
      })
    );
    unlistenFuncs.push(
      listen<string>("analysis_progress", (event) => {
        throttledSetAnalysisProgress(event.payload);
      })
    );
    unlistenFuncs.push(
      listen<ScanCompletePayload>("scan_complete", async (event) => {
        const { projectData, isFirstScan } = event.payload;
        _setScanComplete(projectData);

        if (isFirstScan) {
          let permissionGranted = await isPermissionGranted();
          if (!permissionGranted) {
            const permission = await requestPermission();
            permissionGranted = permission === "granted";
          }
          if (permissionGranted) {
            sendNotification({
              title: t("notifications.firstScanComplete.title"),
              body: t("notifications.firstScanComplete.body"),
            });
          }
        }
      })
    );
    unlistenFuncs.push(
      listen<string>("scan_error", async (event) => {
        _setScanError(event.payload);
        const errorKey = `errors.${event.payload}`;
        const translatedError = t(errorKey);
        await message(
          t("errors.scanError", {
            error:
              translatedError === errorKey ? event.payload : translatedError,
          }),
          {
            title: t("common.error"),
            kind: "error",
          }
        );
      })
    );
    unlistenFuncs.push(
      listen<{ groupId: string; stats: GroupStats; paths: string[] }>(
        "group_update_complete",
        async (event) => {
          _setGroupUpdateComplete(event.payload);
        }
      )
    );
    unlistenFuncs.push(
      listen<string>("auto_sync_error", async (event) => {
        await message(t("errors.syncError", { error: event.payload }), {
          title: t("common.syncError"),
          kind: "error",
        });
      })
    );
    unlistenFuncs.push(
      listen<void>("file_change_detected", () => {
        if (!useAppStore.getState().isScanning) {
          rescanProject();
        }
      })
    );
    // Listener cho sự kiện xuất dự án (để hiển thị toast)
    unlistenFuncs.push(
      listen<string>("project_export_complete", async (event) => {
        try {
          const filePath = await save({
            title: t("dialogs.saveProjectContext.title"),
            defaultPath: "project_context.txt",
            filters: [{ name: t("dialogs.filters.text"), extensions: ["txt"] }],
          });
          if (filePath) {
            await writeTextFile(filePath, event.payload);
            await message(t("dialogs.saveSuccess.body"), {
              title: t("common.success"),
              kind: "info",
            });
          }
        } catch (error) {
          console.error("Lỗi khi lưu file ngữ cảnh dự án:", error);
          await message(t("errors.fileSaveFailed"), {
            title: t("common.error"),
            kind: "error",
          });
        }
      })
    );
    unlistenFuncs.push(
      listen<string>("project_export_error", async (event) => {
        const errorKey = `errors.${event.payload}`;
        const translatedError = t(errorKey);
        await message(
          t("errors.projectExportError", {
            error:
              translatedError === errorKey ? event.payload : translatedError,
          }),
          {
            title: t("common.error"),
            kind: "error",
          }
        );
      })
    );

    return () => {
      unlistenFuncs.forEach((unlisten) => {
        unlisten.then((f) => f());
      });
    };
  }, [
    _setScanProgress,
    _setAnalysisProgress,
    _setScanComplete,
    _setScanError,
    throttledSetScanProgress,
    throttledSetAnalysisProgress,
    _setGroupUpdateComplete,
    rescanProject,
    _setRecentPaths,
    t,
    updateAppSettings,
  ]); // <-- Thêm dependency

  const renderContent = () => {
    if (isScanning) {
      return <ScanningScene />;
    }
    if (!selectedPath) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <WelcomeScene />
        </div>
      );
    }

    if (activeScene === "settings") {
      return <SettingsScene />;
    }

    // --- RENDER LAYOUT MỚI ---
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {isSidebarVisible && (
            <>
              <ResizablePanel
                id="project-panel"
                order={1}
                defaultSize={20}
                minSize={20}
                maxSize={35}
              >
                <SidebarPanel />
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}
          {isGitPanelVisible && (
            <>
              <ResizablePanel
                id="git-panel"
                order={2}
                defaultSize={20}
                minSize={20}
                maxSize={35}
              >
                <GitPanel />
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}
          {/* Nếu không có panel nào hiển thị, ẩn handle đi */}
          {!isSidebarVisible && !isGitPanelVisible && (
            <style>{`[data-slot="resizable-handle"] { display: none; }`}</style>
          )}
          <ResizablePanel id="main-panel" order={3} defaultSize={40}>
            <MainPanel />
          </ResizablePanel>
          {isAiPanelVisible && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel
                id="ai-panel"
                order={4}
                defaultSize={20}
                minSize={20}
                maxSize={35}
              >
                <AIPanel />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
        <StatusBar
          stats={projectStats}
          path={selectedPath}
          gitRepoInfo={gitRepoInfo}
          onShowSettings={showSettingsScene}
        />
      </div>
    );
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground">
      {/* <Toaster richColors /> XÓA DÒNG NÀY */}
      {isRescanning && <RescanIndicator />}
      {renderContent()}
    </div>
  );
}

export default App;
