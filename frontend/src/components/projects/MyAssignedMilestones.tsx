import { useMemo } from "react";
import { Award, CheckCircle2, Circle, Clock, Trash2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMyAssignedMilestones, useRemoveMilestoneAssignee } from "@/hooks/useProjectManagement";
import { useNavigate } from "react-router-dom";

const statusIcons: Record<string, React.ElementType> = {
    pending: Circle,
    in_progress: Clock,
    completed: CheckCircle2,
};

const statusColors: Record<string, string> = {
    pending: "text-muted-foreground",
    in_progress: "text-chart-1",
    completed: "text-success",
};

export function MyAssignedMilestones() {
    const navigate = useNavigate();
    const { data: milestonesResponse, isLoading, error } = useMyAssignedMilestones();
    const removeAssignee = useRemoveMilestoneAssignee();

    // Debug logs
    console.log("MyAssignedMilestones - response:", milestonesResponse);
    console.log("MyAssignedMilestones - loading:", isLoading);
    console.log("MyAssignedMilestones - error:", error);

    const data = useMemo(() => {
        if (!milestonesResponse) return [];
        if (Array.isArray(milestonesResponse)) return milestonesResponse;
        if ((milestonesResponse as any)?.data && Array.isArray((milestonesResponse as any).data)) {
            return (milestonesResponse as any).data;
        }
        return [];
    }, [milestonesResponse]);

    if (isLoading) {
        return (
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">My Milestones</h3>
                </div>
                <p className="text-xs text-muted-foreground">Loading...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">My Milestones</h3>
                </div>
                <p className="text-xs text-destructive">Error loading milestones</p>
            </div>
        );
    }

    if (data.length === 0) {
        return null;
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">My Milestones</h3>
                <Badge variant="secondary" className="text-xs">{data.length}</Badge>
            </div>

            <div className="space-y-2">
                {data.map((m: any) => {
                    const Icon = statusIcons[m.status] || Circle;
                    return (
                        <div
                            key={m.id}
                            className="border border-border rounded-lg bg-card p-3 hover:shadow-md transition"
                        >
                            <div className="flex items-start gap-2">
                                <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", statusColors[m.status])} />

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-medium truncate">{m.name}</h4>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {m.project_name}
                                            </p>
                                        </div>
                                        <Badge variant="outline" className="text-xs capitalize shrink-0">
                                            {m.status.replace(/_/g, " ")}
                                        </Badge>
                                    </div>

                                    {m.due_date && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Due: {new Date(m.due_date).toLocaleDateString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                            })}
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={() => navigate(`/projects/${m.project_id}`)}
                                        title="View milestone"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                        onClick={() =>
                                            removeAssignee.mutate({
                                                milestoneId: m.id,
                                                userId: m.assigned_to,
                                            })
                                        }
                                        title="Remove assignment"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
