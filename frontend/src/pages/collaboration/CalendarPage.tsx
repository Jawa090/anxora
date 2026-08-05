import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Users,
  User,
  Clock,
  RefreshCw,
} from "lucide-react";
import { CalendarMiniWidget } from "@/components/calendar/CalendarMiniWidget";
import { CalendarDayView } from "@/components/calendar/CalendarDayView";
import { CalendarWeekView } from "@/components/calendar/CalendarWeekView";
import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import { CalendarScheduleView } from "@/components/calendar/CalendarScheduleView";
import { CalendarInvitationsView } from "@/components/calendar/CalendarInvitationsView";
import { ConnectCalendarsDialog } from "@/components/calendar/ConnectCalendarsDialog";
import { CalendarConnectSuccessDialog } from "@/components/calendar/CalendarConnectSuccessDialog";
import { ManageCalendarDialog } from "@/components/calendar/ManageCalendarDialog";
import { CalendarSettingsDialog } from "@/components/calendar/CalendarSettingsDialog";
import { ICloudCredentialsDialog } from "@/components/calendar/ICloudCredentialsDialog";
import { CreateEventDialog } from "@/components/calendar/CreateEventDialog";
import { EventDetailDialog } from "@/components/calendar/EventDetailDialog";
import {
  useCalendarEvents,
  type CalendarEvent,
} from "@/hooks/useCalendarEvents";
import { useCalendarConnections } from "@/hooks/useCalendarConnections";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtime } from "@/hooks/useRealtime";
import { cn } from "@/lib/utils";

type ViewType = "day" | "week" | "month" | "schedule" | "invitations";

const viewTabs: { id: ViewType; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "schedule", label: "Schedule" },
  // { id: "invitations", label: "Invitations" },
];

const providerNames: Record<string, string> = {
  google: "Google Calendar",
  icloud: "iCloud Calendar",
  microsoft: "Microsoft Calendar",
};

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeView, setActiveView] = useState<ViewType>("month");
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [icloudDialogOpen, setIcloudDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );
  const [eventDetailOpen, setEventDetailOpen] = useState(false);
  const [moreListDate, setMoreListDate] = useState<Date | null>(null);
  const [isBacking, setIsBacking] = useState(false);
  const [defaultEventHour, setDefaultEventHour] = useState<
    number | undefined
  >();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const [connectSuccessOpen, setConnectSuccessOpen] = useState(false);
  const [connectedProvider, setConnectedProvider] = useState("");
  const [calendarMode, setCalendarMode] = useState<"team" | "personal">("team");
  const [showWorkEvents, setShowWorkEvents] = useState(true);
  const [showHolidays, setShowHolidays] = useState(true);
  const [showBirthdays, setShowBirthdays] = useState(true);
  const { profile } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    connections,
    connect,
    sync,
    disconnect,
    connectICloud,
    syncICloudEvents,
    syncMicrosoftEvents,
    disconnectByProvider,
  } = useCalendarConnections();
  const { on, off } = useRealtime();

  const connected = searchParams.get("connected");
  const error = searchParams.get("error");

  useEffect(() => {
    if (connected) {
      setConnectedProvider(connected);
      setConnectSuccessOpen(true);
      // Trigger auto-sync for newly connected provider
      sync(connected);
      // Clear params
      setSearchParams({}, { replace: true });
      // Refresh connections
      queryClient.invalidateQueries({ queryKey: ["calendar-connections"] });
    }
    if (error) {
      toast({
        title: "Connection failed",
        description: error,
        variant: "destructive",
      });
      setSearchParams({}, { replace: true });
    }
  }, [connected, error, setSearchParams, queryClient, toast, sync]);

  // Real-time sync for calendar events
  useEffect(() => {
    const invalidateEvents = () =>
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });

    on("calendar:event-created", invalidateEvents);
    on("calendar:event-updated", invalidateEvents);
    on("calendar:event-deleted", invalidateEvents);

    return () => {
      off("calendar:event-created", invalidateEvents);
      off("calendar:event-updated", invalidateEvents);
      off("calendar:event-deleted", invalidateEvents);
    };
  }, [on, off, queryClient]);

  // Compute date range for the current view
  const dateRange = useMemo(() => {
    const start = new Date(selectedDate);
    const end = new Date(selectedDate);
    if (activeView === "day") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (activeView === "week") {
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  }, [selectedDate, activeView]);

  const { events: rawEvents, isLoading } = useCalendarEvents(
    debouncedSearchQuery ? undefined : dateRange.start,
    debouncedSearchQuery ? undefined : dateRange.end,
    debouncedSearchQuery,
  );

  const events = useMemo(() => {
    let filtered = rawEvents;

    if (calendarMode === "team") {
      // Team view: only CRM events (shared)
      filtered = filtered.filter((e) => !e.external_provider);
    } else {
      // Personal view: User's own CRM events + User's external events
      filtered = filtered.filter(
        (e) => !!e.external_provider || e.created_by === profile?.id,
      );

      // Apply type filters based on colors assigned during sync
      filtered = filtered.filter((e) => {
        const color = (e.color || "").toLowerCase();

        // Green is usually Holidays
        if (color === "#10b981") return showHolidays;

        // Red is usually Birthdays
        if (color === "#f43f5e") return showBirthdays;

        // Everything else is treated as a "Work Event" or general event
        return showWorkEvents;
      });
    }

    if (!debouncedSearchQuery.trim()) return filtered;
    const query = debouncedSearchQuery.toLowerCase();
    return filtered.filter((e) => {
      const dateStr = format(
        new Date(e.start_time),
        "EEEE MMMM d yyyy",
      ).toLowerCase();
      return (
        e.title.toLowerCase().includes(query) ||
        e.description?.toLowerCase().includes(query) ||
        e.location?.toLowerCase().includes(query) ||
        dateStr.includes(query)
      );
    });
  }, [
    rawEvents,
    debouncedSearchQuery,
    calendarMode,
    profile?.id,
    showHolidays,
    showBirthdays,
    showWorkEvents,
  ]);

  const connectedProviders = connections.map((c) => c.provider);
  const hasConnectedCalendar = connectedProviders.length > 0;

  const handleConnect = async (providerId: string) => {
    if (providerId === "icloud") {
      try {
        await connectICloud.mutateAsync({});
        sync(providerId);
        setConnectDialogOpen(false);
      } catch (err) {
        setConnectDialogOpen(false);
        setIcloudDialogOpen(true);
      }
      return;
    }
    connect(providerId);
  };

  const handleICloudConnect = async (appleId: string, appPassword: string) => {
    try {
      await connectICloud.mutateAsync({ appleId, appPassword });
      sync("icloud");
      setIcloudDialogOpen(false);
    } catch (err) {
      // Error handled by mutation toast
    }
  };

  const handleDisconnect = (providerId: string) => {
    disconnect(providerId);
  };

  const handleManageCalendar = (providerId: string) => {
    setSelectedProvider(providerId);
    setManageDialogOpen(true);
  };

  const handleSync = (providerId?: string) => {
    const target = providerId || selectedProvider;
    if (target) {
      sync(target);
      return;
    }
    toast({
      title: "Syncing...",
      description: "Your calendar is being synchronized.",
    });
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setEventDetailOpen(true);
  };

  const handleSlotClick = (date: Date, hour?: number) => {
    setSelectedDate(date);
    setDefaultEventHour(hour);
    setCreateEventOpen(true);
  };

  const formatHeaderDate = () => {
    if (activeView === "day")
      return selectedDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    if (activeView === "week")
      return selectedDate.toLocaleDateString("en-US", { month: "long" });
    return selectedDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const getWeekdayName = () =>
    selectedDate.toLocaleDateString("en-US", { weekday: "long" });

  const navigatePrev = () => {
    const d = new Date(selectedDate);
    if (activeView === "day") d.setDate(d.getDate() - 1);
    else if (activeView === "week") d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setSelectedDate(d);
  };

  const navigateNext = () => {
    const d = new Date(selectedDate);
    if (activeView === "day") d.setDate(d.getDate() + 1);
    else if (activeView === "week") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setSelectedDate(d);
  };

  const renderView = () => {
    // If searching, force schedule view to show results from any date
    if (debouncedSearchQuery.trim()) {
      return (
        <CalendarScheduleView
          onConnectClick={() => setConnectDialogOpen(true)}
          hasConnectedCalendar={hasConnectedCalendar}
          events={events}
          onEventClick={handleEventClick}
        />
      );
    }

    switch (activeView) {
      case "day":
        return (
          <CalendarDayView
            selectedDate={selectedDate}
            events={events}
            onEventClick={handleEventClick}
            onSlotClick={handleSlotClick}
          />
        );
      case "week":
        return (
          <CalendarWeekView
            selectedDate={selectedDate}
            events={events}
            onEventClick={handleEventClick}
            onSlotClick={handleSlotClick}
          />
        );
      case "month":
        return (
          <CalendarMonthView
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            events={events}
            onEventClick={handleEventClick}
            onSlotClick={(d) => handleSlotClick(d)}
            moreListDate={moreListDate}
            setMoreListDate={setMoreListDate}
          />
        );
      case "schedule":
        return (
          <CalendarScheduleView
            onConnectClick={() => setConnectDialogOpen(true)}
            hasConnectedCalendar={hasConnectedCalendar}
            events={events}
            onEventClick={handleEventClick}
          />
        );
      case "invitations":
        return <CalendarInvitationsView />;
      default:
        return null;
    }
  };
  return (
    <div className="space-y-6">
      {/* Professional Header */}
      <div className="rounded-[22px] border border-border/40 bg-card/85 backdrop-blur-md shadow-sm">
        <div className="px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
              <div className="h-6 w-px bg-border/60" />
              <p className="text-sm text-muted-foreground font-semibold">
                Manage your events
              </p>
            </div>

            {/* Calendar Mode Toggle */}
            <div className="flex items-center p-1 bg-secondary/60 rounded-xl border border-transparent">
              <button
                onClick={() => setCalendarMode("team")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300",
                  calendarMode === "team"
                    ? "bg-secondary-foreground hover:bg-secondary-foreground/80 dark:bg-primary text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Users className="h-4 w-4" />
                Team
              </button>
              <button
                onClick={() => setCalendarMode("personal")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300",
                  calendarMode === "personal"
                    ? "bg-secondary-foreground hover:bg-secondary-foreground/80 dark:bg-primary text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <User className="h-4 w-4" />
                Personal
              </button>
            </div>

            <div className="flex items-center gap-3">
              <Button
                className="gap-2 bg-secondary-foreground hover:bg-secondary-foreground/80 text-white font-semibold rounded-xl shadow-md shadow-primary/10 hover:shadow-primary/25 transition-all duration-300 active:scale-[0.98] shrink-0"
                onClick={() => {
                  setDefaultEventHour(undefined);
                  setCreateEventOpen(true);
                }}
              >
                <Users className="h-4 w-4" />
                New Meeting
              </Button>

              <div className="relative group">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  placeholder="Search Meeting"
                  className="pl-9 h-10 bg-secondary/70 border-transparent hover:bg-secondary focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-[#2DD4BF]/25 focus-visible:border-[#2DD4BF] rounded-xl transition-all w-full text-xs sm:text-sm font-medium"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* <Button
                variant="ghost"
                size="icon"
                className="rounded-xl hover:bg-muted shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => setSettingsDialogOpen(true)}
              >
                <Settings className="h-5 w-5" />
              </Button> */}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Calendar Main View */}
        <div className="lg:col-span-3">
          <div className="rounded-[22px] border border-border/40 bg-card overflow-hidden shadow-sm">
            {/* Calendar Header */}
            <div className="px-6 py-4 border-b border-border/40 bg-secondary/10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-forground dark:text-white">
                    {formatHeaderDate()}
                  </h2>
                  {activeView === "day" && (
                    <p className="text-sm text-foreground mt-1">
                      {getWeekdayName()}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* View Selector */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 bg-secondary-foreground hover:bg-secondary-foreground/80 dark:bg-primary hover:dark:bg-primary/80 hover:text-white text-white shadow-md shadow-primary/10 hover:shadow-primary/25 transition-all duration-300 active:scale-[0.98]"
                      >
                        {activeView.charAt(0).toUpperCase() +
                          activeView.slice(1)}{" "}
                        View
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => setActiveView("day")}>
                        Day View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActiveView("week")}>
                        Week View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActiveView("month")}>
                        Month View
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setActiveView("schedule")}
                      >
                        Schedule View
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Navigation */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={navigatePrev}
                      className="hover:bg-secondary-foreground dark:hover:bg-primary hover:text-white"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDate(new Date())}
                      className={`px-4 rounded-lg border-primary/20 hover:bg-secondary-foreground/80 transition-all
                          ${
                            format(selectedDate, "yyyy-MM-dd") ===
                            format(new Date(), "yyyy-MM-dd")
                              ? "bg-secondary-foreground dark:bg-primary hover:text-white text-white font-semibold"
                              : "bg-secondary-foreground dark:bg-primary hover:text-white text-white font-semibold"
                          }
                        `}
                    >
                      Today
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={navigateNext}
                      className="hover:bg-secondary-foreground dark:hover:bg-primary hover:text-white"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Calendar View Content */}
            <div className="min-h-[600px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary-forground dark:border-primary mx-aut0 mb-4"></div>
                    <p className="text-primary dark:text-primary">
                      Loading calendar...
                    </p>
                  </div>
                </div>
              ) : (
                renderView()
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="lg:col-span-2">
          <div className="rounded-[22px] border border-border/40 bg-card overflow-hidden shadow-sm">
            {/* Mini Calendar - Always visible */}
            <div className="p-6 border-b border-border/40">
              <CalendarMiniWidget
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
              />
            </div>

            {/* Calendar Connections - Only in Personal View */}
            {calendarMode === "personal" && (
              <div className="p-6 space-y-6">
                {/* Event Filters */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Event Filters
                  </h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowWorkEvents(!showWorkEvents)}
                      className={cn(
                        "w-full flex items-center justify-between p-2 rounded-xl transition-all duration-200 border",
                        showWorkEvents
                          ? "bg-blue-50/50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30 text-blue-500 font-semibold"
                          : "border-transparent text-muted-foreground opacity-60 hover:opacity-100",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        <span className="text-xs font-semibold">
                          Work Events
                        </span>
                      </div>
                      {showWorkEvents && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => setShowHolidays(!showHolidays)}
                      className={cn(
                        "w-full flex items-center justify-between p-2 rounded-xl transition-all duration-200 border",
                        showHolidays
                          ? "bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30 text-emerald-500 font-semibold"
                          : "border-transparent text-muted-foreground opacity-60 hover:opacity-100",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="text-xs font-semibold">Holidays</span>
                      </div>
                      {showHolidays && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => setShowBirthdays(!showBirthdays)}
                      className={cn(
                        "w-full flex items-center justify-between p-2 rounded-xl transition-all duration-200 border",
                        showBirthdays
                          ? "bg-rose-50/50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30 text-rose-500 font-semibold"
                          : "border-transparent text-muted-foreground opacity-60 hover:opacity-100",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span className="text-xs font-semibold">Birthdays</span>
                      </div>
                      {showBirthdays && <Check className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-foreground">
                    Calendar Connections
                  </h3>

                  {hasConnectedCalendar ? (
                    <div className="space-y-2">
                      {connections.map((conn) => (
                        <div
                          key={conn.id}
                          className="flex items-center justify-between p-3 bg-secondary/35 border border-border/40 rounded-xl"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                            <span className="text-xs font-semibold text-foreground/90">
                              {providerNames[conn.provider] || conn.provider}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSync(conn.provider)}
                              className="text-xs h-7 w-7 p-0"
                              title="Sync"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleManageCalendar(conn.provider)
                              }
                              className="text-xs px-2 h-7 font-semibold"
                            >
                              Manage
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button
                        className="w-full bg-secondary-foreground text-white font-semibold rounded-xl shadow-md"
                        onClick={() => setConnectDialogOpen(true)}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Sync Calendars
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="w-full bg-secondary-foreground text-white font-semibold rounded-xl shadow-md"
                      onClick={() => setConnectDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Connect Calendar
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom View Tabs */}
      <div className="px-6 py-4 backdrop-blur-sm border-t border-primary bg-primary/10">
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-6 bg-primary/20 dark:bg-muted p-1 rounded-lg ">
            {viewTabs.map((tab) => (
              <Button
                key={tab.id}
                variant="ghost"
                size="sm"
                onClick={() => setActiveView(tab.id)}
                className={`px-4 py-2 h-10 w-20 text-xs border border-secondary rounded-md transition-all duration-200 ${
                  activeView === tab.id
                    ? "bg-secondary-foreground text-white hover:bg-secondary-foreground hover:text-white dark:bg-primary dark:hover:bg-primary shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-secondary-foreground hover:text-white dark:hover:bg-primary dark:hover:text-white"
                } ${tab.id === "invitations" ? "flex items-center gap-1" : ""}`}
              >
                {tab.id === "invitations" && (
                  <span
                    className={
                      activeView === tab.id
                        ? "text-white"
                        : "text-primary group-hover:text-white"
                    }
                  >
                    @
                  </span>
                )}

                {tab.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <ConnectCalendarsDialog
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        connectedCalendars={connectedProviders}
        onConnect={handleConnect}
        onSync={(id) => sync(id)}
        onDisconnect={(id) => disconnect(id)}
      />
      <ManageCalendarDialog
        open={manageDialogOpen}
        onOpenChange={setManageDialogOpen}
        providerId={selectedProvider}
        providerName={providerNames[selectedProvider] || "Calendar"}
        onSync={handleSync}
        onDisconnect={() => handleDisconnect(selectedProvider)}
      />
      <ICloudCredentialsDialog
        open={icloudDialogOpen}
        onOpenChange={setIcloudDialogOpen}
        onConnect={handleICloudConnect}
        isConnecting={connectICloud.isPending}
      />
      <CalendarSettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
      />
      <CreateEventDialog
        open={createEventOpen}
        onOpenChange={setCreateEventOpen}
        defaultDate={selectedDate}
        defaultHour={defaultEventHour}
      />
      <EventDetailDialog
        open={eventDetailOpen}
        onOpenChange={(open) => {
          setEventDetailOpen(open);
          if (!open) {
            if (isBacking) {
              setIsBacking(false);
            } else {
              setMoreListDate(null);
            }
          }
        }}
        event={events.find((e) => e.id === selectedEvent?.id) || selectedEvent}
        onBackToList={
          moreListDate
            ? () => {
                setIsBacking(true);
                setEventDetailOpen(false);
              }
            : undefined
        }
      />
      <CalendarConnectSuccessDialog
        open={connectSuccessOpen}
        onOpenChange={setConnectSuccessOpen}
        provider={connectedProvider}
      />
    </div>
  );
}
