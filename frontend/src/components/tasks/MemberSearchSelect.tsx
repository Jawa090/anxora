import { useState } from "react";
import { Check, ChevronsUpDown, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Member {
    id: string;
    full_name: string;
    avatar_url?: string | null;
}

interface MemberSearchSelectProps {
    members: Member[];
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    placeholder?: string;
}

function MemberAvatar({ member, size = "sm" }: { member: Member; size?: "sm" | "md" }) {
    const initials = (member.full_name || "")
        .split(/\s+/)
        .map((w) => w[0])
        .filter(Boolean)
        .join("")
        .toUpperCase()
        .slice(0, 2) || "?";

    const sizeClass = size === "sm" ? "h-5 w-5 text-[9px]" : "h-6 w-6 text-[10px]";

    if (member.avatar_url) {
        return (
            <Avatar className={cn(sizeClass, "shrink-0")}>
                <AvatarImage src={member.avatar_url} alt={member.full_name} />
                <AvatarFallback className="bg-primary/20 text-primary font-bold">
                    {initials}
                </AvatarFallback>
            </Avatar>
        );
    }

    return (
        <div className={cn(
            sizeClass,
            "shrink-0 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center"
        )}>
            {initials}
        </div>
    );
}

export function MemberSearchSelect({
    members,
    value,
    onChange,
    disabled = false,
    placeholder = "None",
}: MemberSearchSelectProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const selected = members.find((m) => m.id === value);

    const filtered = members.filter((m) =>
        m.full_name.toLowerCase().includes(search.toLowerCase())
    );

    const handleSelect = (id: string) => {
        onChange(id === value ? "" : id);
        setOpen(false);
        setSearch("");
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
                    className={cn(
                        "w-full justify-between font-normal h-10 px-3 transition-all duration-200",
                        selected
                            ? "bg-secondary-foreground/10 border-secondary-foreground/20 text-foreground dark:bg-primary/10 dark:border-primary/20 hover:dark:bg-primary/15"
                            : "bg-muted border-border text-muted-foreground/75"
                    )}
                >
                    <span className="flex items-center gap-2 truncate">
                        {selected ? (
                            <>
                                <MemberAvatar member={selected} size="sm" />
                                <span className="truncate">{selected.full_name}</span>
                            </>
                        ) : (
                            <>
                                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-muted-foreground">{placeholder}</span>
                            </>
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
                        placeholder="Search by name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-7 border-0 p-0 focus-visible:ring-0 bg-transparent text-sm"
                        autoFocus
                    />
                </div>

                {/* List */}
                <div className="max-h-52 overflow-y-auto py-1 bg-muted/50">
                    {/* None option */}
                    <button
                        onClick={() => handleSelect("")}
                        className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left",
                            !value
                                ? "bg-secondary-foreground/15 text-secondary-foreground dark:bg-primary/20 dark:text-primary font-semibold"
                                : "text-foreground hover:bg-secondary-foreground/15 hover:text-secondary-foreground dark:hover:bg-primary/20 dark:hover:text-primary"
                        )}
                    >
                        <Check
                            className={cn(
                                "h-4 w-4 shrink-0",
                                !value ? "opacity-100" : "opacity-0"
                            )}
                        />
                        <User className="h-4 w-4 shrink-0" />
                        <span>None</span>
                    </button>

                    {filtered.length === 0 ? (
                        <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                            No members found
                        </div>
                    ) : (
                        filtered.map((member) => (
                            <button
                                key={member.id}
                                onClick={() => handleSelect(member.id)}
                                className={cn(
                                    "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left",
                                    value === member.id
                                        ? "bg-secondary-foreground/15 text-secondary-foreground dark:bg-primary/20 dark:text-primary font-semibold"
                                        : "text-foreground hover:bg-secondary-foreground/15 hover:text-secondary-foreground dark:hover:bg-primary/20 dark:hover:text-primary"
                                )}
                            >
                                <Check
                                    className={cn(
                                        "h-4 w-4 shrink-0",
                                        value === member.id ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                <MemberAvatar member={member} size="md" />
                                <span className="truncate">{member.full_name}</span>
                            </button>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
