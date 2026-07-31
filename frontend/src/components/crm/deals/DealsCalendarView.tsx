import { useState } from "react";
import { ChevronLeft, ChevronRight, User, DollarSign, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { dealsApi } from "@/lib/api";
import { useNavigate } from "react-router-dom";

interface CalendarDeal {
  id: string;
  title: string;
  stage: string;
  status: string;
  value: number;
  date: string;
  responsiblePersonName?: string;
}

const stageColors: Record<string, string> = {
  drawings_received: "bg-chart-1",
  awaiting_proposal: "bg-chart-2",
  proposal_sent:     "bg-chart-3",
  invoice_sent:      "bg-chart-4",
  proposal_approved: "bg-chart-5",
  in_progress:       "bg-primary",
  project_delivered: "bg-success",
  revision:          "bg-destructive",
  close_deal:        "bg-muted-foreground",
  unqualified:       "bg-muted-foreground",
  won:               "bg-emerald-500",
  lost:              "bg-rose-500",
};

const getStageColor = (stage?: string) =>
  stageColors[(stage || "").toLowerCase()] || "bg-chart-1";

export function DealsCalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const navigate = useNavigate();

  const { data: dealsResponse, isLoading } = useQuery({
    queryKey: ["deals-calendar"],
    queryFn: () => dealsApi.getAll({ limit: 200 }),
  });

  const rawDeals: any[] = dealsResponse?.data || dealsResponse?.deals || (Array.isArray(dealsResponse) ? dealsResponse : []);

  const deals: CalendarDeal[] = rawDeals.map((d: any) => ({
    id: d.id,
    title: d.title || d.name || "Untitled Deal",
    stage: d.stage || "drawings_received",
    status: d.status || "open",
    value: Number(d.value) || 0,
    date:
      d.next_follow_up_date?.split("T")[0] ||
      d.nextFollowUpDate?.split("T")[0] ||
      d.expected_close_date?.split("T")[0] ||
      d.expectedCloseDate?.split("T")[0] ||
      d.created_at?.split("T")[0] ||
      d.createdAt?.split("T")[0] ||
      new Date().toISOString().split("T")[0],
    responsiblePersonName: d.responsible_person_name || d.responsiblePersonName,
  }));

  // Group deals by date
  const dealsByDate: Record<string, CalendarDeal[]> = {};
  deals.forEach((deal) => {
    if (!dealsByDate[deal.date]) dealsByDate[deal.date] = [];
    dealsByDate[deal.date].push(deal);
  });

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    const startingDay = firstDay.getDay();
    for (let i = 0; i < startingDay; i++) {
      days.push({ date: new Date(year, month, -startingDay + i + 1), isCurrentMonth: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    return days;
  };

  const formatDateKey = (date: Date) => date.toISOString().split("T")[0];

  const days = getDaysInMonth(currentDate);
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  const selectedDateKey = formatDateKey(selectedDate);
  const selectedDeals = dealsByDate[selectedDateKey] || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </CardTitle>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => navigate("/crm/deals/create")}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Deal
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((day) => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map(({ date, isCurrentMonth }, index) => {
                const dateKey = formatDateKey(date);
                const dayDeals = dealsByDate[dateKey] || [];
                const isSelected = dateKey === selectedDateKey;
                const isToday = dateKey === formatDateKey(new Date());

                return (
                  <div
                    key={index}
                    className={`
                      min-h-24 p-2 border rounded-lg cursor-pointer transition-colors
                      ${isCurrentMonth ? "bg-card" : "bg-muted/30"}
                      ${isSelected ? "border-primary ring-2 ring-primary/20" : "border-border"}
                      hover:border-primary/50
                    `}
                    onClick={() => setSelectedDate(date)}
                  >
                    <div className={`text-sm font-medium mb-1 ${isToday ? "text-primary" : isCurrentMonth ? "" : "text-muted-foreground"}`}>
                      {date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayDeals.slice(0, 2).map((deal) => (
                        <div
                          key={deal.id}
                          className={`text-xs px-1.5 py-0.5 rounded truncate text-white cursor-pointer hover:opacity-80 ${getStageColor(deal.stage)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/crm/deals/${deal.id}`);
                          }}
                        >
                          {deal.title}
                        </div>
                      ))}
                      {dayDeals.length > 2 && (
                        <div className="text-xs text-muted-foreground px-1">
                          +{dayDeals.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selected Day Panel */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedDeals.length > 0 ? (
              selectedDeals.map((deal) => (
                <div
                  key={deal.id}
                  className="p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/crm/deals/${deal.id}`)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${getStageColor(deal.stage)}`} />
                    <span className="font-medium text-sm truncate">{deal.title}</span>
                    <Badge variant="outline" className="ml-auto text-xs capitalize shrink-0">
                      {deal.stage?.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {deal.responsiblePersonName && (
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3" />
                        {deal.responsiblePersonName}
                      </div>
                    )}
                    {deal.value > 0 && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-3 w-3" />
                        ${deal.value.toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No deals on this day
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Stage Colors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { key: "drawings_received", label: "Drawings Received" },
              { key: "awaiting_proposal", label: "Awaiting Proposal" },
              { key: "proposal_sent", label: "Proposal Sent" },
              { key: "in_progress", label: "In Progress" },
              { key: "project_delivered", label: "Delivered" },
              { key: "unqualified", label: "Unqualified" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${stageColors[key]}`} />
                <span className="text-sm">{label}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
