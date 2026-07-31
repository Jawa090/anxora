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
                    className="w-full justify-between font-normal h-10 px-3"
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
                            "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                            !value
                                ? "bg-primary text-primary-foreground font-medium"
                                : "hover:bg-muted text-foreground"
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
                                    "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                                    value === member.id
                                        ? "bg-primary text-primary-foreground font-medium"
                                        : "hover:bg-muted text-foreground"
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
