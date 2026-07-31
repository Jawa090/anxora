import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Search, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Member {
    id: string;
    full_name: string;
    avatar_url?: string;
    email?: string;
}

interface MemberMultiSelectProps {
    members: Member[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    disabled?: boolean;
    placeholder?: string;
}

function MemberAvatar({ member, size = "sm" }: { member: Member; size?: "sm" | "md" }) {
    const initials = member.full_name
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    const sizeClass = size === "sm" ? "h-5 w-5 text-[9px]" : "h-6 w-6 text-[10px]";

    return (
        <Avatar className={cn(sizeClass, "shrink-0")}>
            {member.avatar_url && (
                <AvatarImage src={member.avatar_url} alt={member.full_name} />
            )}
            <AvatarFallback className="bg-primary/20 text-primary font-bold">
                {initials}
            </AvatarFallback>
        </Avatar>
    );
}

export function MemberMultiSelect({
    members,
    selectedIds,
    onChange,
    disabled = false,
    placeholder = "Select members...",
}: MemberMultiSelectProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const selected = useMemo(
        () => members.filter((m) => selectedIds.includes(m.id)),
        [members, selectedIds]
    );

    const filtered = useMemo(
        () =>
            members.filter(
                (m) =>
                    m.full_name.toLowerCase().includes(search.toLowerCase()) ||
                    m.email?.toLowerCase().includes(search.toLowerCase())
            ),
        [members, search]
    );

    const handleToggle = (id: string) => {
        onChange(
            selectedIds.includes(id)
                ? selectedIds.filter((sid) => sid !== id)
                : [...selectedIds, id]
        );
    };

    const handleRemove = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(selectedIds.filter((sid) => sid !== id));
    };

    return (
        <Popover
            open={open}
            onOpenChange={(o) => {
                setOpen(o);
                if (!o) setSearch("");
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className="w-full justify-between font-normal h-auto min-h-10 px-3 py-2"
                >
                    <span className="flex items-center gap-2 flex-wrap">
                        {selected.length > 0 ? (
                            selected.map((m) => (
                                <Badge
                                    key={m.id}
                                    variant="secondary"
                                    className="gap-1"
                                >
                                    <MemberAvatar member={m} size="sm" />
                                    {m.full_name}
                                    <button
                                        onClick={(e) => handleRemove(m.id, e)}
                                        className="ml-1 hover:opacity-70"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))
                        ) : (
                            <span className="text-muted-foreground">{placeholder}</span>
                        )}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                {/* Search Input */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                    <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                        placeholder="Search members..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-7 border-0 p-0 focus-visible:ring-0 bg-transparent text-sm"
                        autoFocus
                    />
                </div>

                {/* List */}
                <div className="max-h-52 overflow-y-auto py-1">
                    {members.length === 0 ? (
                        <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                            No team members available
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                            No matching members
                        </div>
                    ) : (
                        filtered.map((member) => (
                            <button
                                key={member.id}
                                onClick={() => handleToggle(member.id)}
                                className={cn(
                                    "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors",
                                    selectedIds.includes(member.id) && "bg-primary/5"
                                )}
                            >
                                <Check
                                    className={cn(
                                        "h-4 w-4 shrink-0",
                                        selectedIds.includes(member.id) ? "opacity-100 text-primary" : "opacity-0"
                                    )}
                                />
                                <MemberAvatar member={member} size="md" />
                                <div className="flex-1 min-w-0 text-left">
                                    <p className="text-sm font-medium truncate">
                                        {member.full_name}
                                    </p>
                                    {member.email && (
                                        <p className="text-xs text-muted-foreground truncate">
                                            {member.email}
                                        </p>
                                    )}
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
