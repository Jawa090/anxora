import { X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRemoveMilestoneAssignee } from "@/hooks/useProjectManagement";

interface Assignee {
    id: string;
    full_name: string;
    avatar_url?: string;
    email?: string;
}

interface MilestoneAssigneesDisplayProps {
    assignees: Assignee[];
    milestoneId: string;
    max?: number;
    onEdit?: () => void;
}

export function MilestoneAssigneesDisplay({
    assignees,
    milestoneId,
    max = 3,
    onEdit,
}: MilestoneAssigneesDisplayProps) {
    const removeAssignee = useRemoveMilestoneAssignee();

    const getInitials = (name: string) =>
        name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase();

    const displayAssignees = assignees.slice(0, max);
    const remaining = assignees.length - max;

    return (
        <div className="flex items-center gap-1">
            {displayAssignees.map((assignee) => (
                <TooltipProvider key={assignee.id}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="relative group">
                                <Avatar className="h-7 w-7 border border-border">
                                    <AvatarImage src={assignee.avatar_url} />
                                    <AvatarFallback className="text-xs">
                                        {getInitials(assignee.full_name)}
                                    </AvatarFallback>
                                </Avatar>
                                <button
                                    onClick={() =>
                                        removeAssignee.mutate({
                                            milestoneId,
                                            userId: assignee.id,
                                        })
                                    }
                                    className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition"
                                >
                                    <X className="h-3 w-3 bg-destructive text-destructive-foreground rounded-full" />
                                </button>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <div>
                                <p className="font-medium">{assignee.full_name}</p>
                                <p className="text-xs text-muted-foreground">{assignee.email}</p>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ))}

            {remaining > 0 && (
                <div className="text-xs font-medium px-1.5 py-0.5 rounded bg-muted">
                    +{remaining}
                </div>
            )}

            {onEdit && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={onEdit}
                >
                    <span className="text-xs">+</span>
                </Button>
            )}
        </div>
    );
}
