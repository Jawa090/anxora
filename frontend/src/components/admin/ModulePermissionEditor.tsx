import React, { useState } from "react";
import { DASHBOARD_MODULES, MODULE_PERMISSIONS } from "@/data/permissions.js";
import { Search, Settings2, Lock, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface ModulePermissionEditorProps {
  selectedModules: Record<string, string[]>;
  setSelectedModules: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  availableUsers?: any[];
  filterRole?: string;
}

export function ModulePermissionEditor({
  selectedModules,
  setSelectedModules,
  availableUsers = [],
  filterRole,
}: ModulePermissionEditorProps) {
  const [moduleSearch, setModuleSearch] = useState("");
  const [copyUserId, setCopyUserId] = useState<string>("");

  const togglePermission = (moduleId: string, permission: string) => {
    setSelectedModules((prev) => {
      const current = prev[moduleId] || [];
      if (current.includes(permission)) {
        const next = current.filter((p) => p !== permission);
        if (next.length === 0) {
          const { [moduleId]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [moduleId]: next };
      } else {
        return { ...prev, [moduleId]: [...current, permission] };
      }
    });
  };

  const toggleAllModulePermissions = (moduleId: string, checked: boolean) => {
    if (checked) {
      setSelectedModules((prev) => ({
        ...prev,
        [moduleId]: [...(MODULE_PERMISSIONS as any)[moduleId]],
      }));
    } else {
      setSelectedModules((prev) => {
        const { [moduleId]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const toggleCategoryPermissions = (modules: { id: string }[], checked: boolean) => {
    setSelectedModules((prev) => {
      const next = { ...prev };
      modules.forEach((m) => {
        if (checked) {
          next[m.id] = [...(MODULE_PERMISSIONS as any)[m.id]];
        } else {
          delete next[m.id];
        }
      });
      return next;
    });
  };

  const handleCopyPermissions = (userId?: string) => {
    const id = userId || copyUserId;
    if (id === 'none') {
      setSelectedModules({});
      setCopyUserId('none');
      return;
    }
    const userToCopy = availableUsers.find((u) => u.id === id);
    if (userToCopy && userToCopy.module_permissions) {
      setSelectedModules(userToCopy.module_permissions);
      if (userId) setCopyUserId(userId);
    }
  };

  const filteredUsersToCopy = availableUsers.filter((u) => {
    const hasPerms = u.module_permissions && Object.keys(u.module_permissions).length > 0;
    if (!filterRole) return hasPerms;
    return hasPerms && u.role === filterRole;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Copy From Feature */}
      {availableUsers.length > 0 && (
        <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 space-y-3">
          <label className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
            <Copy className="h-3 w-3" />
            Quick Copy Permissions
          </label>
          <div className="flex gap-2">
            <Select value={copyUserId} onValueChange={(v) => handleCopyPermissions(v)}>
              <SelectTrigger className="bg-background border-border/50 h-10 flex-1">
                <SelectValue placeholder={`Select ${filterRole?.replace('_', ' ') || 'employee'} to copy from...`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-destructive font-semibold border-b border-border/50 mb-1">
                  None / Clear All
                </SelectItem>
                {filteredUsersToCopy.length > 0 ? (
                  filteredUsersToCopy.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name} ({u.role?.replace("_", " ")})
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-xs text-muted-foreground text-center">
                    No existing {filterRole?.replace('_', ' ')}s found with permissions.
                  </div>
                )}
              </SelectContent>
            </Select>
            <Button 
              type="button" 
              variant="secondary" 
              size="sm"
              disabled={!copyUserId}
              onClick={handleCopyPermissions}
              className="h-10 px-4 gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            * This will overwrite current selections with the selected employee's permissions.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter modules..."
            value={moduleSearch}
            onChange={(e) => setModuleSearch(e.target.value)}
            className="pl-9 bg-secondary/30 border-none h-10"
          />
        </div>
      </div>

      <div className="space-y-8 pb-4">
        {DASHBOARD_MODULES.map((cat, catIdx) => {
          const filteredModules = cat.modules.filter(
            (m) =>
              m.name.toLowerCase().includes(moduleSearch.toLowerCase()) ||
              cat.category.toLowerCase().includes(moduleSearch.toLowerCase())
          );

          if (filteredModules.length === 0) return null;

          const isCategoryAllSelected = filteredModules.every((m) => {
            const modulePerms = (MODULE_PERMISSIONS as any)[m.id] || [];
            return (
              modulePerms.length > 0 &&
              selectedModules[m.id]?.length === modulePerms.length
            );
          });

          return (
            <div key={catIdx} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-md font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                  <Settings2 className="h-3 w-3" />
                  {cat.category}
                </h3>
                <div className="flex items-center gap-2">
                  <label className="text-[13px] uppercase font-bold text-muted-foreground cursor-pointer transition-colors">
                    Select Category
                  </label>
                  <Checkbox
                    checked={isCategoryAllSelected}
                    onCheckedChange={(checked) =>
                      toggleCategoryPermissions(cat.modules, !!checked)
                    }
                    className="h-5 w-5 border-blue-600/50 rounded border-blue-600"
                  />
                </div>
              </div>
              <div className="grid gap-3">
                {filteredModules.map((module) => {
                  const modulePerms = (MODULE_PERMISSIONS as any)[module.id] || [];
                  const selectedCount = selectedModules[module.id]?.length || 0;
                  const isAllSelected = modulePerms.length > 0 && selectedCount === modulePerms.length;

                  return (
                    <Card
                      key={module.id}
                      className="border-border/50 bg-secondary/10 overflow-hidden group hover:border-primary/30 transition-all duration-300"
                    >
                      <div className="p-4 bg-secondary/20 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                              selectedCount > 0
                                ? "bg-primary/20 text-primary"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <Lock className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{module.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {selectedCount} of {modulePerms.length} permissions assigned
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground cursor-pointer group-hover:text-primary transition-colors pr-2">
                            Select All
                          </label>
                          <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={(checked) =>
                              toggleAllModulePermissions(module.id, !!checked)
                            }
                            className="h-5 w-5 border-border rounded"
                          />
                        </div>
                      </div>
                      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-card/30">
                        {modulePerms.map((perm: string) => (
                          <div
                            key={perm}
                            className="flex items-center space-x-2 p-2 rounded-md hover:bg-secondary/40 transition-colors cursor-pointer"
                          >
                            <Checkbox
                              id={`${module.id}-${perm}`}
                              checked={selectedModules[module.id]?.includes(perm) || false}
                              onCheckedChange={() => togglePermission(module.id, perm)}
                              className="h-4 w-4"
                            />
                            <label
                              htmlFor={`${module.id}-${perm}`}
                              className="text-sm font-medium leading-none cursor-pointer capitalize"
                            >
                              {perm.replace(/_/g, " ")}
                            </label>
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
