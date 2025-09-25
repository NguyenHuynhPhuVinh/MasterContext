// src/store/actions/groupActions.ts
import { StateCreator } from "zustand";
import { AppState } from "../appStore";
import { type Group, type GroupStats, type FileNode } from "../types";
import { invoke } from "@tauri-apps/api/core";
import {
  getDescendantAndSelfPaths,
  prunePathsForSave,
  expandPaths,
} from "@/lib/treeUtils";
import { defaultGroupStats } from "../initialState";

export interface GroupActions {
  addGroup: (group: Omit<Group, "id" | "paths" | "stats">) => void;
  updateGroup: (group: Partial<Group> & { id: string }) => void;
  deleteGroup: (groupId: string) => void;
  editGroupContent: (groupId: string) => void;
  updateGroupPaths: (groupId: string, paths: string[]) => void;
  _setGroupUpdateComplete: (payload: {
    groupId: string;
    stats: GroupStats;
    paths: string[];
  }) => void;
  startEditingGroup: (groupId: string) => void;
  toggleEditingPath: (node: FileNode, isSelected: boolean) => void;
  cancelEditingGroup: () => void;
  saveEditingGroup: () => Promise<void>;
  selectAllFiles: () => void;
  deselectAllFiles: () => void;
}

export const createGroupActions: StateCreator<
  AppState,
  [],
  [],
  GroupActions
> = (set, get, _store) => {
  const updateGroupsOnBackend = async () => {
    const { rootPath, allGroups, activeProfile } = get();
    const activeGroups = allGroups.get(activeProfile) || [];
    if (rootPath) {
      try {
        await invoke("update_groups_in_project_data", {
          path: rootPath,
          profileName: activeProfile,
          groups: activeGroups,
        });
      } catch (error) {
        console.error("Lỗi khi cập nhật nhóm trên backend:", error);
      }
    }
  };

  return {
    addGroup: (newGroup) => {
      const groupWithDefaults: Group = {
        ...newGroup,
        id: Date.now().toString(),
        paths: [],
        stats: defaultGroupStats(),
        crossSyncEnabled: false,
        tokenLimit: newGroup.tokenLimit || undefined,
      };
      set((state) => {
        const newAllGroups = new Map(state.allGroups);
        const currentGroups = newAllGroups.get(state.activeProfile) || [];
        newAllGroups.set(state.activeProfile, [
          ...currentGroups,
          groupWithDefaults,
        ]);
        return {
          allGroups: newAllGroups,
          groups: newAllGroups.get(state.activeProfile) || [],
          editingGroupId: groupWithDefaults.id,
        };
      });
      get().actions.startEditingGroup(groupWithDefaults.id);
      updateGroupsOnBackend();
    },
    updateGroup: (updatedGroup) => {
      set((state) => {
        const newAllGroups = new Map(state.allGroups);
        const currentGroups = newAllGroups.get(state.activeProfile) || [];
        const updatedGroups = currentGroups.map((g) =>
          g.id === updatedGroup.id ? { ...g, ...updatedGroup } : g
        );
        newAllGroups.set(state.activeProfile, updatedGroups);
        return {
          allGroups: newAllGroups,
          groups: updatedGroups,
        };
      });
      updateGroupsOnBackend();
    },
    deleteGroup: (groupId) => {
      set((state) => {
        const newAllGroups = new Map(state.allGroups);
        const currentGroups = newAllGroups.get(state.activeProfile) || [];
        const updatedGroups = currentGroups.filter((g) => g.id !== groupId);
        newAllGroups.set(state.activeProfile, updatedGroups);
        return {
          allGroups: newAllGroups,
          groups: updatedGroups,
          editingGroupId:
            state.editingGroupId === groupId ? null : state.editingGroupId,
        };
      });
      updateGroupsOnBackend();
    },
    editGroupContent: (groupId) => {
      set({ editingGroupId: groupId, isGroupEditorPanelVisible: true });
      get().actions.startEditingGroup(groupId);
    },
    updateGroupPaths: (groupId, paths) => {
      const { rootPath, activeProfile } = get();
      if (!rootPath) return;
      set({ isUpdatingGroupId: groupId });
      invoke("start_group_update", {
        groupId,
        rootPathStr: rootPath,
        profileName: activeProfile,
        paths,
      });
    },
    _setGroupUpdateComplete: ({ groupId, stats, paths }) => {
      set((state) => {
        const newAllGroups = new Map(state.allGroups);
        const currentGroups = newAllGroups.get(state.activeProfile) || [];
        const updatedGroups = currentGroups.map((g) =>
          g.id === groupId ? { ...g, paths: paths, stats: stats } : g
        );
        newAllGroups.set(state.activeProfile, updatedGroups);
        return {
          allGroups: newAllGroups,
          groups: updatedGroups,
          isUpdatingGroupId: null,
        };
      });
      get().actions.cancelEditingGroup();
    },
    startEditingGroup: (groupId: string) => {
      const { groups, fileTree } = get();
      const group = groups.find((g) => g.id === groupId);
      if (group && fileTree) {
        const expanded = expandPaths(fileTree, new Set(group.paths));
        set({ tempSelectedPaths: expanded });
      }
    },
    toggleEditingPath: (toggledNode: FileNode, isSelected: boolean) => {
      const { isCrossLinkingEnabled, fileMetadataCache, tempSelectedPaths } =
        get();
      if (!tempSelectedPaths || !fileMetadataCache) return;

      const newSelectedPaths = new Set(tempSelectedPaths);

      if (isSelected) {
        const pathsToAdd = new Set<string>();
        const queue = [toggledNode.path];
        const visited = new Set<string>();

        if (isCrossLinkingEnabled) {
          while (queue.length > 0) {
            const currentPath = queue.shift()!;
            if (visited.has(currentPath)) continue;
            visited.add(currentPath);
            pathsToAdd.add(currentPath);

            const metadata = fileMetadataCache[currentPath];
            if (metadata && metadata.links) {
              for (const link of metadata.links) {
                if (!visited.has(link)) queue.push(link);
              }
            }
          }
        } else {
          getDescendantAndSelfPaths(toggledNode).forEach((p) =>
            pathsToAdd.add(p)
          );
        }

        pathsToAdd.forEach((p) => newSelectedPaths.add(p));

        const allPathsArray = Array.from(newSelectedPaths);
        for (const path of allPathsArray) {
          let parentPath = path;
          while (parentPath.lastIndexOf("/") > -1) {
            parentPath = parentPath.substring(0, parentPath.lastIndexOf("/"));
            newSelectedPaths.add(parentPath);
          }
        }
        newSelectedPaths.add("");
      } else {
        const pathsToRemove = getDescendantAndSelfPaths(toggledNode);
        pathsToRemove.forEach((p) => newSelectedPaths.delete(p));
      }

      set({ tempSelectedPaths: newSelectedPaths });
    },
    cancelEditingGroup: () => {
      set({
        editingGroupId: null,
        tempSelectedPaths: null,
        isGroupEditorPanelVisible: false,
      });
    },
    saveEditingGroup: async () => {
      const { editingGroupId, tempSelectedPaths, fileTree } = get();
      if (editingGroupId && tempSelectedPaths && fileTree) {
        const pathsToSave = prunePathsForSave(fileTree, tempSelectedPaths);
        await get().actions.updateGroupPaths(editingGroupId, pathsToSave);
      }
    },
    selectAllFiles: () => {
      const { fileTree } = get();
      if (!fileTree) return;
      const allPaths = getDescendantAndSelfPaths(fileTree);
      set({ tempSelectedPaths: new Set(allPaths) });
    },
    deselectAllFiles: () => {
      set({ tempSelectedPaths: new Set([""]) });
    },
  };
};
