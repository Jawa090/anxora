
import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Search, 
  User, 
  ChevronRight, 
  Save, 
  Lock, 
  AlertCircle,
  CheckCircle2,
  Filter,
  Users
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { usersApi } from "@/lib/api";
import { DASHBOARD_MODULES, MODULE_PERMISSIONS } from "@/data/permissions";
import { useAuth } from "@/contexts/AuthContext";
import { PermissionGuard } from "@/components/auth/PermissionGuard";

const PermissionCenter = () => {
  const { user, refreshProfile, updateProfilePermissions } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedModules, setSelectedModules] = useState({});
  const [moduleSearch, setModuleSearch] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await usersApi.getAll();
      setUsers(data);
    } catch (error) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setSelectedModules(user.module_permissions || {});
  };

  const handlePermissionToggle = (moduleId, action) => {
    setSelectedModules(prev => {
      const current = prev[moduleId] || [];
      const updated = current.includes(action)
        ? current.filter(a => a !== action)
        : [...current, action];
      
      return {
        ...prev,
        [moduleId]: updated
      };
    });
  };

  const handleSelectAllModule = (moduleId, grant) => {
    setSelectedModules(prev => {
      const updated = { ...prev };
      if (grant) {
        updated[moduleId] = MODULE_PERMISSIONS[moduleId];
      } else {
        delete updated[moduleId];
      }
      return updated;
    });
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    
    setSaving(true);
    try {
      await usersApi.update(selectedUser.id, {
        module_permissions: selectedModules
      });
      
      // Update local state
      setUsers(users.map(u => 
        u.id === selectedUser.id 
          ? { ...u, module_permissions: selectedModules } 
          : u
      ));
      setSelectedUser((prev) =>
        prev ? { ...prev, module_permissions: selectedModules } : prev
      );
      if (user?.id === selectedUser.id) {
        updateProfilePermissions(selectedModules);
        await refreshProfile();
      }
      
      toast.success("Permissions updated successfully");
    } catch (error) {
      toast.error(error.message || "Failed to update permissions");
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredModules = DASHBOARD_MODULES.map(cat => ({
    ...cat,
    modules: cat.modules.filter(m => 
      m.name.toLowerCase().includes(moduleSearch.toLowerCase()) ||
      cat.category.toLowerCase().includes(moduleSearch.toLowerCase())
    )
  })).filter(cat => cat.modules.length > 0);

  return (
    <PermissionGuard module="members" action="edit">
      <div className="flex h-[calc(100vh-120px)] gap-6 overflow-hidden">
      {/* Left Sidebar: User List */}
      <Card className="w-80 flex flex-col shadow-lg border-primary/10">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Employees
            </CardTitle>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search employees..." 
              className="pl-9 bg-muted/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-1">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <div key={i} className="h-14 w-full bg-muted/30 animate-pulse rounded-md mt-2" />
                ))
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground italic">No employees found</div>
              ) : (
                filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleUserSelect(u)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left group ${
                      selectedUser?.id === u.id 
                        ? 'bg-primary text-primary-foreground shadow-md' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      selectedUser?.id === u.id ? 'bg-primary-foreground/20' : 'bg-primary/10 text-primary'
                    }`}>
                      {u.full_name?.charAt(0).toUpperCase() || <User className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{u.full_name}</div>
                      <div className={`text-xs truncate ${
                        selectedUser?.id === u.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}>
                        {u.role} • {u.department || 'No Dept'}
                      </div>
                    </div>
                    <ChevronRight className={`h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity ${
                      selectedUser?.id === u.id ? 'opacity-100' : ''
                    }`} />
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Main Content: Permission Matrix */}
      <Card className="flex-1 flex flex-col shadow-xl border-primary/5 bg-background/50 backdrop-blur-sm">
        {!selectedUser ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-4">
            <div className="p-6 rounded-full bg-primary/5 border border-primary/10">
              <Shield className="h-16 w-16 text-primary/40" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-foreground">Permission Center</h3>
              <p className="max-w-xs">Select an employee from the left to manage their module-level access permissions.</p>
            </div>
          </div>
        ) : (
          <>
            <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 pb-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-inner">
                  {selectedUser.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold">{selectedUser.full_name}'s Access</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">{selectedUser.role}</Badge>
                    <Badge variant="secondary">{selectedUser.email}</Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-64 mr-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search modules..." 
                    className="pl-9 h-9"
                    value={moduleSearch}
                    onChange={(e) => setModuleSearch(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="gradient-primary shadow-lg hover:shadow-primary/20 transition-all font-semibold"
                >
                  {saving ? <Lock className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Permissions
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-8 pb-12">
                  {filteredModules.map((category) => (
                    <div key={category.category} className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                          {category.category}
                        </Badge>
                        <Separator className="flex-1" />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {category.modules.map((module) => {
                          const availableActions = MODULE_PERMISSIONS[module.id] || [];
                          const selectedActions = selectedModules[module.id] || [];
                          const isAllSelected = selectedActions.length === availableActions.length && availableActions.length > 0;
                          const isCustom = selectedActions.length > 0 && selectedActions.length < availableActions.length;

                          return (
                            <Card key={module.id} className={`transition-all duration-300 border-l-4 ${
                              selectedActions.length > 0 ? 'border-l-primary shadow-md' : 'border-l-transparent opacity-80'
                            }`}>
                              <CardHeader className="p-4 pb-2 space-y-0">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-lg">{module.name}</h4>
                                    {isAllSelected && <Badge variant="default" className="bg-green-500 hover:bg-green-600 h-5 px-1.5 text-[10px]">Full Access</Badge>}
                                    {isCustom && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">Partial</Badge>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground font-medium">Full Access</span>
                                    <Checkbox 
                                      checked={isAllSelected}
                                      onCheckedChange={(checked) => handleSelectAllModule(module.id, !!checked)}
                                    />
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="p-4 pt-0">
                                <div className="flex flex-wrap gap-x-6 gap-y-3 mt-3">
                                  {availableActions.map((action) => (
                                    <div key={action} className="flex items-center space-x-2 group cursor-pointer">
                                      <Checkbox 
                                        id={`${module.id}-${action}`}
                                        checked={selectedActions.includes(action)}
                                        onCheckedChange={() => handlePermissionToggle(module.id, action)}
                                      />
                                      <label 
                                        htmlFor={`${module.id}-${action}`}
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize cursor-pointer transition-colors group-hover:text-primary"
                                      >
                                        {action.replace(/_/g, ' ')}
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </>
        )}
      </Card>
      </div>
    </PermissionGuard>
  );
};

export default PermissionCenter;
