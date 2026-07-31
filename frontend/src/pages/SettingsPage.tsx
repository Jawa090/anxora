import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  User,
  Building2,
  Bell,
  Palette,
  Shield,
  Globe,
  Mail,
  Phone,
  Camera,
  Save,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  Users,
  Copy,
  Plug,
} from "lucide-react";
import InstantlyIntegrationPanel from "@/components/admin/InstantlyIntegrationPanel";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { api } from "@/lib/api";
import { getAvatarUrl } from "@/lib/utils";
import { toast } from "sonner";

const SETTINGS_TAB_KEY = "settings_active_tab";

export default function SettingsPage() {
  const { profile, user, refreshProfile, userRole } = useAuth();
  const { organization, currentRole, refreshOrganization } = useOrganization();

  const isAdmin =
    userRole?.role === "admin" || userRole?.role === "super_admin";

  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem(SETTINGS_TAB_KEY) || "profile"
  );

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    localStorage.setItem(SETTINGS_TAB_KEY, value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList
          className={`grid w-full lg:w-auto lg:inline-grid ${isAdmin ? "grid-cols-4" : "grid-cols-3"}`}
        >
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="organization" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Organization</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="integrations" className="gap-2">
              <Plug className="h-4 w-4" />
              <span className="hidden sm:inline">Integrations</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileSettings />
        </TabsContent>
        <TabsContent value="organization" className="mt-6">
          <OrganizationSettings />
        </TabsContent>
        <TabsContent value="notifications" className="mt-6">
          <NotificationSettings />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="integrations" className="mt-6">
            <InstantlyIntegrationPanel />
          </TabsContent>
        )}
        <TabsContent value="appearance" className="mt-6">
          <AppearanceSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileSettings() {
  const { profile, user, refreshProfile, userRole } = useAuth();
  const { currentRole } = useOrganization();
  const isAdmin =
    userRole?.role === "admin" || userRole?.role === "super_admin";
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState((profile as any)?.phone || "");
  const [jobTitle, setJobTitle] = useState(
    (profile as any)?.position || (profile as any)?.job_title || "",
  );
  const [department, setDepartment] = useState(
    (profile as any)?.department || "",
  );
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone((profile as any).phone || "");
      setJobTitle(
        (profile as any).position || (profile as any).job_title || "",
      );
      setDepartment((profile as any).department || "");
    }
  }, [profile]);

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await api.put(`/auth/profile`, {
        fullName: fullName,
        phone,
        position: jobTitle,
        department,
      });
      toast.success("Profile updated");
      await refreshProfile();
    } catch {
      toast.error("Failed to update profile");
    }
    setSaving(false);
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setChangingPassword(true);
    try {
      await api.post(`/auth/change-password`, {
        currentPassword,
        newPassword,
      });
      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message);
    }
    setChangingPassword(false);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    setUploadingAvatar(true);
    try {
      await api.post("/auth/upload-avatar", formData);
      toast.success("Profile photo updated");
      await refreshProfile();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to upload photo");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const initials =
    profile?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Personal Information
          </CardTitle>
          <CardDescription>
            Update your personal details and contact information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <Avatar className="h-24 w-24 border-2 border-primary/20">
                <AvatarImage src={getAvatarUrl(profile?.avatar_url)} />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Camera className="h-6 w-6" />
                )}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                className="hidden"
                accept="image/*"
              />
            </div>
            <div>
              <p className="font-bold text-xl text-foreground">
                {profile?.full_name}
              </p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {currentRole && (
                  <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    {currentRole.name}
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  Change Photo
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={!isAdmin}
                className={!isAdmin ? "bg-muted" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user?.email || ""}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                disabled={!isAdmin}
                className={!isAdmin ? "bg-muted" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job Title</Label>
              <Input
                id="jobTitle"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Sales Manager"
                disabled={!isAdmin}
                className={!isAdmin ? "bg-muted" : ""}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Sales"
                disabled={!isAdmin}
                className={!isAdmin ? "bg-muted" : ""}
              />
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end">
              <Button onClick={saveProfile} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Change Password
          </CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pr-12"
                />
                <a
                  type="button"
                  className="absolute right-0 top-0 h-10 w-10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center justify-center cursor-pointer"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </a>
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="pr-12"
                />
                <a
                  type="button"
                  className="absolute right-0 top-0 h-10 w-10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center justify-center cursor-pointer"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </a>
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pr-12"
                />
                <a
                  type="button"
                  className="absolute right-0 top-0 h-10 w-10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center justify-center cursor-pointer"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </a>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={changePassword}
              disabled={changingPassword || !newPassword || !currentPassword}
            >
              {changingPassword ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  member: "Member",
  viewer: "Viewer",
};

function OrganizationSettings() {
  const { organization, refreshOrganization } = useOrganization();
  const { userRole } = useAuth();
  const isSuperAdmin = userRole?.role === "super_admin";
  const isAdmin = userRole?.role === "admin" || userRole?.role === "super_admin";

  const [orgName, setOrgName] = useState(organization?.name || "");
  const [attendanceMachineIp, setAttendanceMachineIp] = useState((organization as any)?.attendance_machine_ip || "");
  const [workingHoursPerDay, setWorkingHoursPerDay] = useState((organization as any)?.working_hours_per_day || 9.0);
  const [breakTimeHours, setBreakTimeHours] = useState((organization as any)?.break_time_hours || 1.0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (organization) {
      if (organization.name) setOrgName(organization.name);
      setAttendanceMachineIp((organization as any).attendance_machine_ip || "");
      setWorkingHoursPerDay((organization as any).working_hours_per_day || 9.0);
      setBreakTimeHours((organization as any).break_time_hours || 1.0);
    }
  }, [organization]);

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["org-members"],
    queryFn: () => api.get<{ members: any[] }>("/organizations/members"),
    staleTime: 30000,
  });
  const members = membersData?.members || [];

  const saveOrg = async () => {
    if (!organization || !isSuperAdmin) return;
    setSaving(true);
    try {
      await api.put(`/organizations/${organization.id}`, { 
        name: orgName,
        attendance_machine_ip: attendanceMachineIp,
        working_hours_per_day: Number(workingHoursPerDay),
        break_time_hours: Number(breakTimeHours)
      });
      toast.success("Organization updated");
      await refreshOrganization();
    } catch {
      toast.error("Failed to update organization");
    }
    setSaving(false);
  };

  const copyId = () => {
    navigator.clipboard.writeText(organization?.id || "");
    toast.success("Organization ID copied");
  };

  return (
    <div className="space-y-6">
      {/* Organization Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Organization Details
          </CardTitle>
          <CardDescription>
            {isSuperAdmin
              ? "Only Super Admin can change organization name"
              : "View your organization information"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Org Name — editable only by super_admin */}
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={!isSuperAdmin}
                className={!isSuperAdmin ? "bg-muted" : ""}
              />
            </div>

            {/* Domain — always read-only */}
            <div className="space-y-2">
              <Label>Domain</Label>
              <Input
                value={organization?.domain || "—"}
                disabled
                className="bg-muted"
              />
            </div>
            
            {/* ZKTeco IP (ADMS Server Setting) */}
            {isAdmin && (
              <div className="space-y-2">
                <Label htmlFor="attendanceMachineIp">Biometric ADMS Push IP/URL</Label>
                <Input
                  id="attendanceMachineIp"
                  value={attendanceMachineIp}
                  onChange={(e) => setAttendanceMachineIp(e.target.value)}
                  disabled={!isSuperAdmin}
                  className={!isSuperAdmin ? "bg-muted" : ""}
                  placeholder="e.g. 192.168.25.118"
                />
              </div>
            )}

            {/* Attendance Rules */}
            <div className="space-y-2">
              <Label htmlFor="workingHoursPerDay">Total Working Hours/Day</Label>
              <Input
                id="workingHoursPerDay"
                type="number"
                step="0.5"
                value={workingHoursPerDay}
                onChange={(e) => setWorkingHoursPerDay(e.target.value)}
                disabled={!isSuperAdmin}
                className={!isSuperAdmin ? "bg-muted" : ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="breakTimeHours">Break Time (Hours)</Label>
              <Input
                id="breakTimeHours"
                type="number"
                step="0.25"
                value={breakTimeHours}
                onChange={(e) => setBreakTimeHours(e.target.value)}
                disabled={!isSuperAdmin}
                className={!isSuperAdmin ? "bg-muted" : ""}
              />
            </div>

            {/* Org ID — display only, copyable */}
            <div className="space-y-2 sm:col-span-2">
              <Label>Organization ID</Label>
              <div className="flex gap-2">
                <Input
                  value={organization?.id || "—"}
                  disabled
                  className="bg-muted font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyId}
                  title="Copy ID"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {isSuperAdmin && (
            <div className="flex justify-end">
              <Button onClick={saveOrg} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security & Access */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Security & Access
          </CardTitle>
          <CardDescription>Organization security overview</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-4 text-center">
              <p className="text-2xl font-bold text-foreground">
                {organization?.id ? "Active" : "—"}
              </p>
              <p className="text-sm text-muted-foreground">Status</p>
            </div>
            <div className="rounded-lg border border-border p-4 text-center">
              <p className="text-2xl font-bold text-foreground capitalize">
                {userRole?.role?.replace("_", " ") || "—"}
              </p>
              <p className="text-sm text-muted-foreground">Your Role</p>
            </div>
            <div className="rounded-lg border border-border p-4 text-center">
              <p className="text-2xl font-bold text-foreground">API</p>
              <p className="text-sm text-muted-foreground">Data Protection</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationSettings() {
  const { profile, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>({
    crm: true,
    tasks: true,
    hrms: true,
    recruitment: true,
    collaboration: true,
    general: true,
  });

  useEffect(() => {
    if (profile?.notification_settings) {
      setSettings(profile.notification_settings);
    }
  }, [profile]);

  const toggleSetting = (key: string) => {
    setSettings((prev: any) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const saveNotifications = async () => {
    setSaving(true);
    try {
      await api.patch("/auth/notification-settings", { settings });
      toast.success("Notification preferences saved");
      await refreshProfile();
    } catch (err) {
      toast.error("Failed to save preferences");
    }
    setSaving(false);
  };

  const notifItems = [
    {
      id: "crm",
      label: "CRM & Deals",
      desc: "Leads, deals, and assignment updates",
      icon: Globe,
      value: settings.crm,
    },
    {
      id: "tasks",
      label: "Projects & Tasks",
      desc: "Task assignments and status changes",
      icon: Bell,
      value: settings.tasks,
    },
    {
      id: "hrms",
      label: "HR & Leave",
      desc: "Leave requests and attendance alerts",
      icon: User,
      value: settings.hrms,
    },
    {
      id: "recruitment",
      label: "Recruitment",
      desc: "Candidate status and interview updates",
      icon: Building2,
      value: settings.recruitment,
    },
    {
      id: "collaboration",
      label: "Collaboration",
      desc: "Direct messages and mentions",
      icon: Mail,
      value: settings.collaboration,
    },
    {
      id: "general",
      label: "System Alerts",
      desc: "Important general system notifications",
      icon: Shield,
      value: settings.general,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Choose which real-time notifications you'd like to receive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {notifItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {item.label}
                </p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
            <Switch
              checked={item.value}
              onCheckedChange={() => toggleSetting(item.id)}
            />
          </div>
        ))}
        <Separator className="my-4" />
        <div className="flex justify-end">
          <Button onClick={saveNotifications} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AppearanceSettings() {
  const [language, setLanguage] = useState("en");
  const [dateFormat, setDateFormat] = useState("MM/DD/YYYY");
  const [timeFormat, setTimeFormat] = useState("12h");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [compactMode, setCompactMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const saveAppearance = () => {
    toast.success("Appearance settings saved");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Regional Settings
          </CardTitle>
          <CardDescription>
            Configure language, date, and time preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">Eastern (ET)</SelectItem>
                  <SelectItem value="America/Chicago">Central (CT)</SelectItem>
                  <SelectItem value="America/Denver">Mountain (MT)</SelectItem>
                  <SelectItem value="America/Los_Angeles">
                    Pacific (PT)
                  </SelectItem>
                  <SelectItem value="Europe/London">London (GMT)</SelectItem>
                  <SelectItem value="Europe/Berlin">Berlin (CET)</SelectItem>
                  <SelectItem value="Asia/Dubai">Dubai (GST)</SelectItem>
                  <SelectItem value="Asia/Kolkata">India (IST)</SelectItem>
                  <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date Format</Label>
              <Select value={dateFormat} onValueChange={setDateFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Time Format</Label>
              <Select value={timeFormat} onValueChange={setTimeFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                  <SelectItem value="24h">24-hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Display Preferences
          </CardTitle>
          <CardDescription>Customize how the application looks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">
                Compact Mode
              </p>
              <p className="text-xs text-muted-foreground">
                Reduce spacing for denser information display
              </p>
            </div>
            <Switch checked={compactMode} onCheckedChange={setCompactMode} />
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">
                Sidebar Collapsed by Default
              </p>
              <p className="text-xs text-muted-foreground">
                Start with the sidebar minimized
              </p>
            </div>
            <Switch
              checked={sidebarCollapsed}
              onCheckedChange={setSidebarCollapsed}
            />
          </div>
          <Separator />
          <div className="flex justify-end">
            <Button onClick={saveAppearance}>
              <Save className="h-4 w-4 mr-2" />
              Save Preferences
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
