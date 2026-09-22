import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, BarChart3, Settings, Users, Clock, Palmtree, Home } from "lucide-react";
import MyLeavesTab from "@/components/hrms/leave/MyLeavesTab";
import WorkFromHomeTab from "@/components/hrms/leave/WorkFromHomeTab";
import TeamLeavesTab from "@/components/hrms/leave/TeamLeavesTab";
import LeaveCalendarTab from "@/components/hrms/leave/LeaveCalendarTab";
import LeaveAnalyticsTab from "@/components/hrms/leave/LeaveAnalyticsTab";
import LeaveSettingsTab from "@/components/hrms/leave/LeaveSettingsTab";
import HolidaysPage from "@/pages/hrms/HolidaysPage";
import { useAuth } from "@/contexts/AuthContext";

export default function LeaveManagementPage() {
  const { userRole } = useAuth();
  const isSuperAdmin = userRole?.role === "super_admin";
  const isAdmin =
    isSuperAdmin ||
    userRole?.role === "admin" ||
    userRole?.role === "manager"
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = isSuperAdmin ? "team-leaves" : "my-leaves";
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab");
    if (tab === "my-leaves" && isSuperAdmin) return "team-leaves";
    return tab || defaultTab;
  });

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) {
      if (isSuperAdmin && tab === "my-leaves") {
        setActiveTab("team-leaves");
        setSearchParams({ tab: "team-leaves" }, { replace: true });
      } else {
        setActiveTab(tab);
      }
    } else if (isSuperAdmin && activeTab === "my-leaves") {
      setActiveTab("team-leaves");
    }
  }, [searchParams, isSuperAdmin]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Leave Management</h1>
        <p className="text-muted-foreground mt-1">Manage leave requests, balances, and policies</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList
          className={`grid w-full lg:w-auto lg:inline-grid ${isSuperAdmin ? "grid-cols-6" : isAdmin ? "grid-cols-7" : "grid-cols-3"
            }`}
        >
          {!isSuperAdmin && (
            <TabsTrigger value="my-leaves" className="gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">My Leaves</span>
            </TabsTrigger>
          )}

          <TabsTrigger value="work-from-home" className="gap-2">
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Work From Home</span>
          </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="team-leaves" className="gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Approval Leaves</span>
              </TabsTrigger>

              <TabsTrigger value="calendar" className="gap-2">
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Calendar</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Leave Quota</span>
              </TabsTrigger>
            </>
          )}
          <TabsTrigger value="holidays" className="gap-2">
            <Palmtree className="h-4 w-4" />
            <span className="hidden sm:inline">Public Holidays</span>
          </TabsTrigger>
        </TabsList>

        {!isSuperAdmin && (
          <TabsContent value="my-leaves" className="space-y-4">
            <MyLeavesTab />
          </TabsContent>
        )}

        <TabsContent value="work-from-home" className="space-y-4">
          <WorkFromHomeTab />
        </TabsContent>

        <TabsContent value="holidays" className="space-y-4">
          <HolidaysPage />
        </TabsContent>

        {isAdmin && (
          <>
            <TabsContent value="team-leaves" className="space-y-4">
              <TeamLeavesTab />
            </TabsContent>
            <TabsContent value="calendar" className="space-y-4">
              <LeaveCalendarTab />
            </TabsContent>
            <TabsContent value="analytics" className="space-y-4">
              <LeaveAnalyticsTab />
            </TabsContent>
            <TabsContent value="settings" className="space-y-4">
              <LeaveSettingsTab />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
