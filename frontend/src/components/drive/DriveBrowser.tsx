import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Folder,
  File,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  Upload,
  Download,
  Trash2,
  Edit,
  Loader2,
  RefreshCw,
  ExternalLink,
  Clock,
  Star,
  ShieldAlert,
  Archive,
  HardDrive,
  CloudOff,
  RotateCcw,
  Share2,
  FileText,
  TableProperties,
  Presentation,
  Plus,
} from "lucide-react";
import { googleDriveService, DriveFile } from "@/services/googleDriveService";
import { toast } from "sonner";
import { ConnectedDrive } from "@/hooks/useDrives";
import { useCustomDialog } from "@/contexts/DialogContext";
import { useDriveRealtime } from "@/hooks/useRealtime";
import {
  getUnifiedFileIcon,
  formatFileSize,
  formatRelativeDate,
} from "./driveUtils";
import { DriveFileListSkeleton } from "./DriveFileListSkeleton";

interface DriveBrowserProps {
  drive: ConnectedDrive;
  onClose: () => void;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

export function DriveBrowser({ drive, onClose }: DriveBrowserProps) {
  const { confirm } = useCustomDialog();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFolderId = searchParams.get("folder") || "root";
  const initialFilter = searchParams.get("filter") || undefined;

  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolderId, setCurrentFolderId] = useState(initialFolderId);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: "root", name: "Google Drive" },
  ]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [needsReauth, setNeedsReauth] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<string | undefined>(initialFilter);

  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DriveFile | null>(null);
  const [newName, setNewName] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<DriveFile | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState("reader");

  const loadFiles = useCallback(
    async (folderId: string, append = false, isBackground = false) => {
      if (!append && !isBackground) setLoading(true);
      try {
        const response = await googleDriveService.listFiles(
          drive.id,
          folderId,
          append ? nextPageToken : undefined,
          currentFilter,
        );

        if (append) {
          setFiles((prev) => [...prev, ...response.files]);
        } else {
          setFiles(response.files);
        }
        setNextPageToken(response.nextPageToken);
        setNeedsReauth(false);
      } catch (error: any) {
        if (
          error.message.includes("401") ||
          error.message.includes("invalid_grant")
        ) {
          setNeedsReauth(true);
        } else {
          toast.error(error.message || "Failed to load files");
        }
      } finally {
        setLoading(false);
      }
    },
    [drive.id, nextPageToken, currentFilter],
  );

  useDriveRealtime(() => {
    loadFiles(currentFolderId);
  });

  useEffect(() => {
    loadFiles(currentFolderId);

    // Background polling for external changes (mobile app sync)
    const interval = setInterval(() => {
      loadFiles(currentFolderId, false, true);
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [currentFolderId, drive.id, currentFilter, loadFiles]);

  const navigateToFolder = (folder: DriveFile) => {
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setCurrentFolderId(folder.id);
    
    // Update URL
    const newParams = new URLSearchParams(searchParams);
    newParams.set("folder", folder.id);
    setSearchParams(newParams);
  };

  const navigateToBreadcrumb = (index: number) => {
    const item = breadcrumbs[index];
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setCurrentFilter(undefined);
    setCurrentFolderId(item.id);
    
    // Update URL
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("filter");
    newParams.set("folder", item.id);
    setSearchParams(newParams);
  };

  const handleFilterChange = (filter: string | undefined) => {
    setCurrentFilter(filter);
    setCurrentFolderId("root");
    
    // Update URL
    const newParams = new URLSearchParams(searchParams);
    if (filter) {
      newParams.set("filter", filter);
    } else {
      newParams.delete("filter");
    }
    newParams.set("folder", "root");
    setSearchParams(newParams);

    setBreadcrumbs([
      {
        id: "root",
        name: filter
          ? filter.charAt(0).toUpperCase() + filter.slice(1)
          : "Google Drive",
      },
    ]);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      setActionLoading(true);
      await googleDriveService.createFolder(
        drive.id,
        newFolderName,
        currentFolderId,
      );
      toast.success("Folder created");
      setNewFolderDialogOpen(false);
      setNewFolderName("");
      loadFiles(currentFolderId);
    } catch (error: any) {
      toast.error(error.message || "Failed to create folder");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRename = async () => {
    if (!renameTarget || !newName.trim()) return;
    try {
      setActionLoading(true);
      await googleDriveService.rename(drive.id, renameTarget.id, newName);
      toast.success("Renamed successfully");
      setRenameDialogOpen(false);
      setRenameTarget(null);
      setNewName("");
      loadFiles(currentFolderId);
    } catch (error: any) {
      toast.error(error.message || "Failed to rename");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (file: DriveFile) => {
    if (
      !(await confirm(`Are you sure you want to delete "${file.name}"?`, {
        variant: "destructive",
        title: "Delete Item",
      }))
    )
      return;
    try {
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      await googleDriveService.delete(drive.id, file.id);
      toast.success("Moved to trash");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete");
      loadFiles(currentFolderId);
    }
  };

  const handleDownload = async (file: DriveFile) => {
    try {
      toast.info("Downloading...");
      await googleDriveService.downloadFile(drive.id, file.id);
      toast.success("Download complete");
    } catch (error: any) {
      toast.error(error.message || "Failed to download");
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      toast.info("Uploading...");
      const uploadUrl = await googleDriveService.getUploadUrl(
        drive.id,
        file.name,
        file.type,
        currentFolderId,
      );
      const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("Upload failed");
      toast.success("File uploaded");
      loadFiles(currentFolderId);
    } catch (error: any) {
      // "Failed to fetch" is a common false-positive error for resumable uploads
      // due to browser CORS policies on the response, even if the upload succeeded.
      if (error.message === "Failed to fetch" || error.name === "TypeError") {
        toast.success("File uploaded and processing...");
        // Auto-refresh after a delay to show the file
        setTimeout(() => loadFiles(currentFolderId), 2000);
      } else {
        console.error("Upload error:", error);
        toast.error(error.message || "Failed to upload");
      }
    }
    event.target.value = "";
  };

  const handleRestore = async (file: DriveFile) => {
    try {
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      await googleDriveService.restore(drive.id, file.id);
      toast.success("Item restored");
    } catch (error: any) {
      toast.error(error.message || "Failed to restore");
      loadFiles(currentFolderId);
    }
  };

  const handlePermanentDelete = async (file: DriveFile) => {
    if (
      !(await confirm(
        `Permanently delete "${file.name}"? This cannot be undone.`,
        { variant: "destructive", title: "Permanent Delete" },
      ))
    )
      return;
    try {
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      await googleDriveService.permanentDelete(drive.id, file.id);
      toast.success("Item permanently deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete permanently");
      loadFiles(currentFolderId);
    }
  };

  const handleToggleStar = async (file: DriveFile) => {
    try {
      const newStarred = !file.starred;
      // Optimistic update
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, starred: newStarred } : f)),
      );
      await googleDriveService.toggleStar(drive.id, file.id, newStarred);
      toast.success(newStarred ? "Added to Starred" : "Removed from Starred");
    } catch (error: any) {
      toast.error(error.message || "Failed to update star status");
      loadFiles(currentFolderId);
    }
  };

  const handleToggleSpam = async (file: DriveFile) => {
    try {
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      await googleDriveService.toggleSpam(drive.id, file.id, true);
      toast.success("Moved to Spam");
    } catch (error: any) {
      toast.error(error.message || "Failed to mark as spam");
      loadFiles(currentFolderId);
    }
  };

  const handleToggleOffline = async (file: DriveFile) => {
    try {
      const isOffline = file.appProperties?.offline === "true";
      const newOffline = !isOffline;
      // Optimistic update
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id
            ? {
                ...f,
                appProperties: {
                  ...f.appProperties,
                  offline: newOffline ? "true" : "false",
                },
              }
            : f,
        ),
      );
      await googleDriveService.toggleOffline(drive.id, file.id, newOffline);
      toast.success(newOffline ? "Available offline" : "Online only");
    } catch (error: any) {
      toast.error(error.message || "Failed to update offline status");
      loadFiles(currentFolderId);
    }
  };

  const handleShare = async () => {
    if (!shareTarget || !shareEmail.trim()) return;
    try {
      setActionLoading(true);
      await googleDriveService.share(
        drive.id,
        shareTarget.id,
        shareEmail,
        shareRole,
      );
      toast.success(`Shared with ${shareEmail}`);
      setShareDialogOpen(false);
      setShareEmail("");
    } catch (error: any) {
      toast.error(error.message || "Failed to share");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateGoogleFile = async (type: "doc" | "sheet" | "slide") => {
    try {
      setActionLoading(true);
      const file = await googleDriveService.createGoogleFile(
        drive.id,
        type,
        undefined,
        currentFolderId,
      );
      toast.success(`Created Google ${type}`);
      if (file.webViewLink) {
        window.open(file.webViewLink, "_blank");
      }
      loadFiles(currentFolderId);
    } catch (error: any) {
      toast.error(error.message || `Failed to create google ${type}`);
    } finally {
      setActionLoading(false);
    }
  };

  const isFolder = (file: DriveFile) =>
    file.mimeType === "application/vnd.google-apps.folder";

  const getFilterTitle = () => {
    if (!currentFilter) return drive.display_name;
    const titles: Record<string, string> = {
      recent: "Recent",
      starred: "Starred",
      offline: "Offline",
      // spam: "Spam",
      trash: "Bin",
    };
    return titles[currentFilter] || drive.display_name;
  };

  const getEmptyState = () => {
    const messages: Record<string, { title: string; desc: string; icon: any }> =
      {
        recent: {
          title: "No recent files",
          desc: "Files you've recently opened or edited will appear here.",
          icon: Clock,
        },
        starred: {
          title: "No starred files",
          desc: "Add stars to things you want to find easily.",
          icon: Star,
        },
        offline: {
          title: "No offline files",
          desc: "Files you've made available offline will appear here.",
          icon: CloudOff,
        },
        // spam: { title: "Spam is empty", desc: "Items in the spam folder will be shown here.", icon: ShieldAlert },
        trash: {
          title: "Bin is empty",
          desc: "Items moved to the trash will appear here.",
          icon: Trash2,
        },
      };

    const config = currentFilter
      ? messages[currentFilter]
      : {
          title: "This folder is empty",
          desc: "Drag and drop files here to upload.",
          icon: Folder,
        };

    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground p-8 text-center bg-muted/5 rounded-lg border-2 border-dashed m-6">
        <config.icon className="h-12 w-12 mb-4 opacity-20" />
        <p className="font-semibold text-foreground">{config.title}</p>
        <p className="text-sm max-w-xs">{config.desc}</p>
      </div>
    );
  };

  return (
    <Card className="h-full flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 border-r bg-muted/20 flex flex-col shrink-0">
        <div className="p-4 flex flex-col gap-1">
          <Button
            variant="ghost"
            className="justify-start gap-2 h-9 mb-2 text-primary hover:bg-primary hover:text-white"
            onClick={onClose}
          >
            <ChevronLeft className="h-4 w-4" /> Back to Drives
          </Button>
          <div className="h-px bg-border my-1" />

          <Button
            variant={!currentFilter ? "secondary" : "ghost"}
            className="justify-start gap-2 h-9"
            onClick={() => handleFilterChange(undefined)}
          >
            <HardDrive className="h-4 w-4" /> My Drive
          </Button>
          <Button
            variant={currentFilter === "recent" ? "secondary" : "ghost"}
            className="justify-start gap-2 h-9"
            onClick={() => handleFilterChange("recent")}
          >
            <Clock className="h-4 w-4" /> Recent
          </Button>
          <Button
            variant={currentFilter === "starred" ? "secondary" : "ghost"}
            className="justify-start gap-2 h-9"
            onClick={() => handleFilterChange("starred")}
          >
            <Star className="h-4 w-4" /> Starred
          </Button>
          {/* <Button 
            variant={currentFilter === "spam" ? "secondary" : "ghost"} 
            className="justify-start gap-2 h-9" 
            onClick={() => handleFilterChange("spam")}
          >
            <ShieldAlert className="h-4 w-4" /> Spam
            </Button> */}
          <Button
            variant={currentFilter === "offline" ? "secondary" : "ghost"}
            className="justify-start gap-2 h-9"
            onClick={() => handleFilterChange("offline")}
          >
            <CloudOff className="h-4 w-4" /> Offline
          </Button>
          <Button
            variant={currentFilter === "trash" ? "secondary" : "ghost"}
            className="justify-start gap-2 h-9"
            onClick={() => handleFilterChange("trash")}
          >
            <Trash2 className="h-4 w-4" /> Bin
          </Button>
        </div>

        <div className="mt-auto p-4 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
            <RefreshCw className="h-3 w-3 animate-spin-slow" />
            <span>Auto-sync enabled</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={onClose}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-lg">{getFilterTitle()}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadFiles(currentFolderId)}
              >
                <RefreshCw className="h-4 w-4 mr-1" /> Refresh
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-1" /> New
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={() => setNewFolderDialogOpen(true)}
                  >
                    <FolderPlus className="h-4 w-4 mr-2" /> New Folder
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleCreateGoogleFile("doc")}
                  >
                    <FileText className="h-4 w-4 mr-2 text-blue-600" /> Google
                    Docs
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleCreateGoogleFile("sheet")}
                  >
                    <TableProperties className="h-4 w-4 mr-2 text-green-600" />{" "}
                    Google Sheets
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleCreateGoogleFile("slide")}
                  >
                    <Presentation className="h-4 w-4 mr-2 text-orange-600" />{" "}
                    Google Slides
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <label>
                <Button variant="default" size="sm" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-1" /> Upload
                  </span>
                </Button>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>

          <div className="flex items-center gap-1 text-sm mt-2 overflow-x-auto">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.id} className="flex items-center">
                {index > 0 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />
                )}
                <button
                  onClick={() => navigateToBreadcrumb(index)}
                  className={`hover:underline ${index === breadcrumbs.length - 1 ? "font-medium" : "text-muted-foreground"}`}
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto p-0">
          {loading ? (
            <DriveFileListSkeleton />
          ) : needsReauth ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-4">
              <RefreshCw className="h-12 w-12 opacity-50" />
              <div className="text-center">
                <p className="font-medium text-foreground">
                  Google Drive Access Expired
                </p>
                <p className="text-sm">
                  Please reconnect your Google Drive to continue.
                </p>
              </div>
              <Button variant="default" onClick={onClose}>
                Go Back to Reconnect
              </Button>
            </div>
          ) : files.length === 0 ? (
            getEmptyState()
          ) : (
            <div className="divide-y">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => {
                    if (isFolder(file)) navigateToFolder(file);
                    else if (file.webViewLink)
                      window.open(file.webViewLink, "_blank");
                  }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getUnifiedFileIcon(file.mimeType, isFolder(file))}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="font-medium truncate">{file.name}</p>
                        {file.starred && (
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 shrink-0" />
                        )}
                        {file.appProperties?.offline === "true" && (
                          <RefreshCw className="h-3 w-3 text-emerald-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatRelativeDate(file.modifiedTime)} ·{" "}
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      asChild
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {isFolder(file) ? (
                        <DropdownMenuItem
                          onClick={() => navigateToFolder(file)}
                        >
                          <Folder className="h-4 w-4 mr-2" /> Open
                        </DropdownMenuItem>
                      ) : (
                        <>
                          <DropdownMenuItem
                            onClick={() => handleDownload(file)}
                          >
                            <Download className="h-4 w-4 mr-2" /> Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setShareTarget(file);
                              setShareDialogOpen(true);
                            }}
                          >
                            <Share2 className="h-4 w-4 mr-2" /> Share
                          </DropdownMenuItem>
                          {file.webViewLink && (
                            <DropdownMenuItem
                              onClick={() =>
                                window.open(file.webViewLink, "_blank")
                              }
                            >
                              <ExternalLink className="h-4 w-4 mr-2" /> Open in
                              Google Drive
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleToggleStar(file)}
                          >
                            <Star
                              className={`h-4 w-4 mr-2 ${file.starred ? "fill-yellow-400 text-yellow-400" : ""}`}
                            />
                            {file.starred ? "Unstar" : "Star"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggleOffline(file)}
                          >
                            <CloudOff className="h-4 w-4 mr-2" />
                            {file.appProperties?.offline === "true"
                              ? "Remove offline"
                              : "Make available offline"}
                          </DropdownMenuItem>
                          {!isFolder(file) && (
                            <DropdownMenuItem
                              onClick={() => handleToggleSpam(file)}
                            >
                              <ShieldAlert className="h-4 w-4 mr-2" /> Mark as
                              Spam
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                      <DropdownMenuSeparator />
                      {currentFilter === "trash" ? (
                        <>
                          <DropdownMenuItem onClick={() => handleRestore(file)}>
                            <RotateCcw className="h-4 w-4 mr-2" /> Restore
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive font-semibold"
                            onClick={() => handlePermanentDelete(file)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                            Permanently
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <>
                          <DropdownMenuItem
                            onClick={() => {
                              setRenameTarget(file);
                              setNewName(file.name);
                              setRenameDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(file)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}

              {nextPageToken && (
                <div className="p-4 text-center">
                  <Button
                    variant="outline"
                    onClick={() => loadFiles(currentFolderId, true)}
                    disabled={loading}
                  >
                    Load More
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>

        {/* New Folder Dialog */}
        <Dialog
          open={newFolderDialogOpen}
          onOpenChange={setNewFolderDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
              <DialogDescription>
                Enter a name for the new folder.
              </DialogDescription>
            </DialogHeader>
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setNewFolderDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateFolder}
                disabled={actionLoading || !newFolderName.trim()}
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rename Dialog */}
        <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename</DialogTitle>
              <DialogDescription>Enter a new name.</DialogDescription>
            </DialogHeader>
            <Input
              placeholder="New name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRenameDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRename}
                disabled={actionLoading || !newName.trim()}
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Rename"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Share Dialog */}
        <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share "{shareTarget?.name}"</DialogTitle>
              <DialogDescription>
                Enter an email address to share this file.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Email Address</label>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Role</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={shareRole}
                  onChange={(e) => setShareRole(e.target.value)}
                >
                  <option value="reader">Viewer</option>
                  <option value="commenter">Commenter</option>
                  <option value="writer">Editor</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShareDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleShare}
                disabled={actionLoading || !shareEmail}
              >
                {actionLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Share
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
}
