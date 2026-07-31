/**
 * CreatableSelect
 *
 * A dropdown where:
 * - Users can pick an existing option
 * - Add new options inline (persisted to localStorage per org + field key)
 * - Rename existing custom options inline
 * - Default (built-in) options cannot be deleted but can be renamed
 * - All customizations survive page refresh (per-org storage)
 */
import { useState, useEffect, useRef } from "react";
import { Check, ChevronDown, Plus, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface SelectOption {
  value: string;
  label: string;
  isCustom?: boolean; // true = user-added, can be deleted
}

interface CreatableSelectProps {
  /** Storage key — must be unique per field (e.g. "customerType"). Used for persistence. */
  storageKey?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
}

// ── persistence helpers ────────────────────────────────────────────────────
function storageId(orgId: string | null | undefined, key: string) {
  return `ANXORA_select_opts_${orgId ?? "default"}_${key}`;
}

function loadCustomOptions(orgId: string | null | undefined, key: string): SelectOption[] {
  try {
    const raw = localStorage.getItem(storageId(orgId, key));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomOptions(orgId: string | null | undefined, key: string, opts: SelectOption[]) {
  localStorage.setItem(storageId(orgId, key), JSON.stringify(opts));
}

// ── component ──────────────────────────────────────────────────────────────
export function CreatableSelect({
  storageKey = "unknown",
  label,
  value,
  onChange,
  options: builtInOptions,
  placeholder = "Select...",
  disabled = false,
}: CreatableSelectProps) {
  const { profile } = useAuth();
  const orgId = profile?.org_id;

  // Custom options (persisted)
  const [customOptions, setCustomOptions] = useState<SelectOption[]>(() =>
    loadCustomOptions(orgId, storageKey)
  );

  // Reload from storage when orgId resolves (async auth)
  useEffect(() => {
    setCustomOptions(loadCustomOptions(orgId, storageKey));
  }, [orgId, storageKey]);

  // Merge: built-in first, then custom, with custom label overrides applied
  const allOptions: SelectOption[] = (() => {
    const map = new Map<string, SelectOption>();
    for (const o of builtInOptions) map.set(o.value, { ...o, isCustom: false });
    for (const o of customOptions) {
      // custom entry can be a label-override of a built-in OR a brand-new entry
      map.set(o.value, { ...o, isCustom: true });
    }
    return Array.from(map.values());
  })();

  const selectedOption = allOptions.find((o) => o.value === value);

  // UI state
  const [open, setOpen] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const newInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // ── add new option ───────────────────────────────────────────────────────
  const handleAdd = () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    // Special rule: "Instantly" gets a capital I, everything else is fully lowercase
    const isInstantly = trimmed.toLowerCase() === "instantly";
    const formattedLabel = isInstantly ? "Instantly" : trimmed.toLowerCase();
    
    // Force the value (key) to be "Instantly" if it matches, otherwise lowercase slug
    const key = isInstantly ? "Instantly" : trimmed.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    
    if (allOptions.find((o) => o.value.toLowerCase() === key.toLowerCase())) {
      // already exists — just select it
      onChange(allOptions.find((o) => o.value.toLowerCase() === key.toLowerCase())?.value || key);
      setNewLabel("");
      setAddingNew(false);
      setOpen(false);
      return;
    }
    const next = [...customOptions, { value: key, label: formattedLabel, isCustom: true }];
    setCustomOptions(next);
    saveCustomOptions(orgId, storageKey, next);
    onChange(key);
    setNewLabel("");
    setAddingNew(false);
    setOpen(false);
  };

  // ── save renamed label ───────────────────────────────────────────────────
  const handleSaveEdit = () => {
    const trimmed = editLabel.trim();
    if (!editingValue || !trimmed) { setEditingValue(null); return; }
    // Special rule: "Instantly" gets a capital I, everything else is fully lowercase
    const isInstantly = trimmed.toLowerCase() === "instantly";
    const formattedLabel = isInstantly ? "Instantly" : trimmed.toLowerCase();
    const existing = customOptions.findIndex((o) => o.value === editingValue);
    let next: SelectOption[];
    if (existing >= 0) {
      next = customOptions.map((o) =>
        o.value === editingValue ? { ...o, label: formattedLabel } : o
      );
    } else {
      // Override a built-in option's label
      next = [...customOptions, { value: editingValue, label: trimmed, isCustom: true }];
    }
    setCustomOptions(next);
    saveCustomOptions(orgId, storageKey, next);
    setEditingValue(null);
    setEditLabel("");
  };

  // ── delete custom option ─────────────────────────────────────────────────
  const handleDelete = (optValue: string) => {
    const next = customOptions.filter((o) => o.value !== optValue);
    setCustomOptions(next);
    saveCustomOptions(orgId, storageKey, next);
    if (value === optValue) onChange("");
  };

  // ── disabled (view-only) ─────────────────────────────────────────────────
  if (disabled) {
    return (
      <div className="min-h-[2.5rem] px-3 py-2 border border-border rounded-lg bg-muted/40 flex items-center">
        <span className={cn("text-sm", selectedOption ? "text-foreground font-medium" : "text-muted-foreground italic")}>
          {selectedOption?.label || (value || "Not specified")}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {label && (
        <label className="text-sm font-medium text-foreground">{label}</label>
      )}

      <Popover open={open} onOpenChange={(o) => {
        setOpen(o);
        if (!o) { setAddingNew(false); setNewLabel(""); setEditingValue(null); setEditLabel(""); }
      }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "w-full flex items-center justify-between h-9 px-3 rounded-lg border border-border bg-background text-sm transition-all",
              "hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
              !selectedOption && "text-muted-foreground"
            )}
          >
            <span className="truncate">{selectedOption?.label || placeholder}</span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-[--radix-popover-trigger-width] p-1" align="start" sideOffset={4}>
          <ScrollArea className="max-h-[140px] overflow-y-auto">
            <div className="py-1">
              {allOptions.map((opt) => {
                const isEditing = editingValue === opt.value;
                return (
                  <div
                    key={opt.value}
                    className={cn(
                      "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm",
                      !isEditing && "hover:bg-accent cursor-pointer"
                    )}
                    onClick={() => {
                      if (!isEditing) {
                        onChange(opt.value);
                        setOpen(false);
                      }
                    }}
                  >
                    {/* Selected checkmark */}
                    <Check className={cn("h-4 w-4 shrink-0 text-primary", value === opt.value ? "opacity-100" : "opacity-0")} />

                    {/* Label or inline edit input */}
                    {isEditing ? (
                      <div className="flex flex-1 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Input
                          ref={editInputRef}
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className="h-7 text-xs flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); handleSaveEdit(); }
                            if (e.key === "Escape") { setEditingValue(null); setEditLabel(""); }
                          }}
                        />
                        <button type="button" onClick={handleSaveEdit} className="p-1 text-green-500 hover:text-green-400 shrink-0">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => { setEditingValue(null); setEditLabel(""); }} className="p-1 text-muted-foreground hover:text-foreground shrink-0">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 truncate">{opt.label}</span>
                        {/* Edit button — visible on hover */}
                        <button
                          type="button"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingValue(opt.value);
                            setEditLabel(opt.label);
                          }}
                          title="Rename"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        {/* Delete button — only for user-added custom options */}
                        {opt.isCustom && (
                          <button
                            type="button"
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={(e) => { e.stopPropagation(); handleDelete(opt.value); }}
                            title="Delete"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Divider + Add new section */}
          <div className="border-t mt-1 pt-1">
            {addingNew ? (
              <div className="flex items-center gap-1 px-2 py-1">
                <Input
                  ref={newInputRef}
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="New option name..."
                  className="h-7 text-xs flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleAdd(); }
                    if (e.key === "Escape") { setAddingNew(false); setNewLabel(""); }
                  }}
                />
                <button type="button" onClick={handleAdd} className="p-1 text-green-500 hover:text-green-400 shrink-0">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => { setAddingNew(false); setNewLabel(""); }} className="p-1 text-muted-foreground hover:text-foreground shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                onClick={() => setAddingNew(true)}
              >
                <Plus className="h-4 w-4" />
                Add option
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
