import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FolderOpen,
  File,
  Image,
  FileText,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Settings,
  List,
  Grid3X3,
  LayoutGrid,
  ChevronDown,
  FolderPlus,
  FileUp,
  Cloud,
  Server,
  Loader2,
  ArrowLeft,
  Upload,
  Download,
  X,
  Undo2,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ConnectCompanyDriveDialog } from "@/components/drive/ConnectCompanyDriveDialog";
import { ConnectPersonalDriveDialog } from "@/components/drive/ConnectPersonalDriveDialog";
import { DriveSettingsDialog } from "@/components/drive/DriveSettingsDialog";
import { CompanyDrivesList } from "@/components/drive/CompanyDrivesList";
import { PersonalDrivesList } from "@/components/drive/PersonalDrivesList";
import { DriveBrowser } from "@/components/drive/DriveBrowser";
import { NetworkDriveBrowser } from "@/components/drive/NetworkDriveBrowser";
import { OneDriveBrowser } from "@/components/drive/OneDriveBrowser";
import { CreateFolderDialog } from "@/components/drive/CreateFolderDialog";
import { useConnectedDrives, ConnectedDrive } from "@/hooks/useDrives";
import {
  useDriveFolders,
  useDriveFiles,
  useDriveSearch,
  formatFileSize,
  formatDate,
  getFileTypeFromMime,
} from "@/hooks/useDriveData";
import { googleDriveService } from "@/services/googleDriveService";
import { toast } from "sonner";

type ViewMode = "list" | "grid" | "compact";

const folderColors: Record<string, string> = {
  "folder-blue": "hsl(var(--primary))",
  "folder-orange": "hsl(24, 100%, 50%)",
  "folder-rose": "hsl(350 89% 60%)",
  "folder-violet": "hsl(270 100% 60%)",
  "folder-amber": "hsl(40 100% 50%)",
  "folder-green": "hsl(120 100% 50%)",
};

export default function DrivePage() {
  const { userRole } = useAuth();
  const { driveId: paramDriveId } = useParams<{ driveId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date_changed");
  const [companyDriveDialogOpen, setCompanyDriveDialogOpen] = useState(false);
  const [personalDriveDialogOpen, setPersonalDriveDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [browsingDrive, setBrowsingDrive] = useState<ConnectedDrive | null>(
    null,
  );
  const [processingOAuth, setProcessingOAuth] = useState(false);
  const [previewFile, setPreviewFile] = useState<{
    id: string;
    name: string;
    url: string;
    mimeType: string;
  } | null>(null);
  const [currentFolderName, setCurrentFolderName] = useState<string | null>(
    null,
  );
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [isTextLoading, setIsTextLoading] = useState(false);
  const [isRecycleBin, setIsRecycleBin] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    id: string;
    name: string;
    type: "file" | "folder";
    permanent?: boolean;
  } | null>(null);

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: allDrives } = useConnectedDrives();
  const isAdmin =
    userRole?.role === "admin" || userRole?.role === "super_admin";

  // Use real data hooks
  const { folders, createFolder, deleteFolder, permanentDeleteFolder } =
    useDriveFolders(selectedFolder || undefined, isRecycleBin);
  const {
    files,
    uploadFile,
    deleteFile,
    restoreFile,
    permanentDeleteFile,
    bulkRestoreItems,
    bulkMoveToTrashItems,
    bulkPermanentDeleteItems,
  } = useDriveFiles(selectedFolder || undefined, undefined, isRecycleBin);
  const searchResults = useDriveSearch(searchQuery);

  // Use search results if searching, otherwise use regular files — memoized to prevent new refs on every render
  const displayFiles = useMemo(
    () =>
      searchQuery.length >= 2
        ? searchResults.data?.filter((item: any) => item.type === "file") || []
        : files,
    [searchQuery, searchResults.data, files],
  );
  const displayFolders = useMemo(
    () =>
      searchQuery.length >= 2
        ? searchResults.data?.filter((item: any) => item.type === "folder") || []
        : folders,
    [searchQuery, searchResults.data, folders],
  );

  const handleFolderClick = (folderId: string, folderName: string) => {
    setSelectedFiles([]);
    setSelectedFolder(folderId);
    setCurrentFolderName(folderName);
    toast.success(`Opening ${folderName} folder`);
  };

  const handleBackToRoot = () => {
    setSelectedFiles([]);
    setIsRecycleBin(false);
    setSelectedFolder(null);
    setCurrentFolderName(null);
    toast.info("Back to My Drive");
  };

  const getFileUrl = (url: string | null) => {
    if (!url) return undefined;
    const baseUrl =
      import.meta.env.VITE_API_URL?.replace("/api", "") || import.meta.env.VITE_APP_URL || "http://localhost:4000";
    return `${baseUrl}${url}`;
  };

  const handleFileClick = async (
    fileName: string,
    fileUrl: string | null = null,
    mimeType: string = "",
    fileId: string = "",
  ) => {
    if (fileUrl) {
      const fullUrl = getFileUrl(fileUrl) || "";
      setPreviewFile({ id: fileId, name: fileName, url: fullUrl, mimeType });
      setPreviewText(null);

      // If it's a text file or has no extension/is .env, try to fetch content
      const isText =
        mimeType.startsWith("text/") ||
        fileName.endsWith(".env") ||
        fileName.endsWith(".js") ||
        fileName.endsWith(".ts") ||
        fileName.endsWith(".json") ||
        fileName.endsWith(".sql");

      if (isText) {
        setIsTextLoading(true);
        try {
          const response = await fetch(fullUrl);
          const text = await response.text();
          setPreviewText(text);
        } catch (error) {
          console.error("Error fetching preview text:", error);
          setPreviewText("Failed to load file content.");
        } finally {
          setIsTextLoading(false);
        }
      }
    } else {
      toast.success(`Opening ${fileName}`);
    }
  };

  const handleDownload = async (fileName: string, fileUrl: string | null) => {
    if (!fileUrl) {
      toast.error("File URL not found");
      return;
    }

    try {
      const url = getFileUrl(fileUrl);
      if (!url) return;

      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      toast.success(`Downloading ${fileName}`);
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download file");
    }
  };

  const handleFileUpload = () => {
    if (!selectedFolder) {
      toast.error("Please select a folder first by clicking on it!");
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        const folderName =
          folders.find((f) => f.id === selectedFolder)?.name ||
          "Selected folder";
        Array.from(files).forEach((file) => {
          uploadFile.mutate({ file, folderId: selectedFolder || undefined });
        });
        toast.success(`Uploading ${files.length} file(s) to ${folderName}`);
      }
    };
    input.click();
  };

  const handleCreateFolder = () => {
    setCreateFolderDialogOpen(true);
  };

  const handleCreateFolderSubmit = (name: string, color: string) => {
    createFolder.mutate({
      name: name,
      parent_folder_id: selectedFolder || undefined,
      color: color,
    });
  };

  const handleRecycleBin = () => {
    setSelectedFiles([]);
    setIsRecycleBin(true);
    setSelectedFolder(null);
    toast.info("Showing deleted files and folders");
  };

  const toggleSelection = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedFiles((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleSelectAll = (visibleItems: any[]) => {
    if (
      selectedFiles.length === visibleItems.length &&
      visibleItems.length > 0
    ) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(visibleItems.map((i) => i.id));
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmation) return;

    if (deleteConfirmation.id === "bulk") {
      if (deleteConfirmation.permanent) {
        bulkPermanentDeleteItems.mutate(selectedFiles);
        setSelectedFiles([]);
      }
    } else {
      if (deleteConfirmation.permanent) {
        if (deleteConfirmation.type === "file") {
          permanentDeleteFile.mutate(deleteConfirmation.id);
        } else {
          permanentDeleteFolder.mutate(deleteConfirmation.id);
        }
      } else if (deleteConfirmation.type === "file") {
        deleteFile.mutate(deleteConfirmation.id);
      } else {
        deleteFolder.mutate(deleteConfirmation.id);
      }
    }
    setDeleteConfirmation(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (selectedFolder && !isRecycleBin) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (!selectedFolder) {
      toast.error("Please select a folder first by clicking on it!");
      return;
    }

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const folderName =
        folders.find((f) => f.id === selectedFolder)?.name || "Selected folder";
      Array.from(files).forEach((file) => {
        uploadFile.mutate({ file, folderId: selectedFolder });
      });
      toast.success(`Uploading ${files.length} file(s) to ${folderName}`);
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "u":
            e.preventDefault();
            handleFileUpload();
            break;
          case "n":
            e.preventDefault();
            handleCreateFolder();
            break;
          case "f":
            e.preventDefault();
            (
              document.querySelector(
                'input[placeholder="Filter and search"]',
              ) as HTMLInputElement
            )?.focus();
            break;
        }
      }
      if (e.key === "Escape") {
        setSelectedFolder(null);
        setSearchQuery("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const connected = searchParams.get("connected");
  const error = searchParams.get("error");
  const driveId = searchParams.get("driveId");

  // Handle OAuth success/error from backend redirect
  useEffect(() => {
    if (connected === "google_drive") {
      toast.success("Google Drive connected successfully!");
      if (driveId) {
        navigate(`/collaboration/drive/personal/${driveId}`);
      }
      setSearchParams({}, { replace: true });
    } else if (error) {
      toast.error(error || "Failed to connect Google Drive");
      setSearchParams({}, { replace: true });
    }
  }, [connected, error, driveId, setSearchParams, navigate]);

  const handleBrowseDrive = (drive: ConnectedDrive) => {
    const isNetworkDriveType = [
      "network_smb",
      "network_nfs",
      "network_webdav",
    ].includes(drive.drive_type);

    // Network drives are always considered connected
    if (
      !isNetworkDriveType &&
      !drive.access_token &&
      drive.drive_type === "google_drive"
    ) {
      toast.error(
        "This drive is not yet connected. Please authenticate first.",
      );
      return;
    }
    // Update URL
    const newParams = new URLSearchParams(searchParams);
    newParams.set("driveId", drive.id);
    setSearchParams(newParams);
    
    setBrowsingDrive(drive);
  };

  // Restore session from URL driveId
  useEffect(() => {
    const urlDriveId = searchParams.get("driveId");
    if (urlDriveId && allDrives && !browsingDrive) {
        const driveToRestore = allDrives.find(d => d.id === urlDriveId);
        if (driveToRestore) {
            setBrowsingDrive(driveToRestore);
        }
    }
  }, [allDrives, searchParams, browsingDrive]);

  const isNetworkDrive = (drive: ConnectedDrive) =>
    ["network_smb", "network_nfs", "network_webdav"].includes(drive.drive_type);

  const getFileIcon = (mimeType: string) => {
    const fileType = getFileTypeFromMime(mimeType);
    switch (fileType) {
      case "image":
        return (
          <Image className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        );
      case "pdf":
        return <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />;
      case "document":
        return (
          <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        );
      case "presentation":
        return (
          <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
        );
      case "spreadsheet":
        return (
          <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
        );
      case "video":
        return (
          <File className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        );
      case "text":
        return (
          <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        );
      default:
        return <File className="h-5 w-5 text-primary" />;
    }
  };

  // Sort folders and files based on sortBy — memoized to prevent re-sort on every render
  const sortedFolders = useMemo(() => {
    return [...displayFolders].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "date_created":
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        case "date_changed":
          return (
            new Date(b.updated_at || b.created_at).getTime() -
            new Date(a.updated_at || a.created_at).getTime()
          );
        default:
          return 0;
      }
    });
  }, [displayFolders, sortBy]);

  const sortedFiles = useMemo(() => {
    return [...displayFiles].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "size":
          return (b.file_size || 0) - (a.file_size || 0);
        case "date_created":
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        case "date_changed":
          return (
            new Date(b.updated_at || b.created_at).getTime() -
            new Date(a.updated_at || a.created_at).getTime()
          );
        default:
          return 0;
      }
    });
  }, [displayFiles, sortBy]);

  const sortOptions = [
    { value: "date_changed", label: "By date changed" },
    { value: "date_created", label: "By date created" },
    { value: "name", label: "By name" },
    { value: "size", label: "By size" },
  ];

  // Show drive browser if browsing a drive
  if (browsingDrive) {
    return (
      <div className="h-[calc(100vh-120px)]">
        {isNetworkDrive(browsingDrive) ? (
          <NetworkDriveBrowser
            drive={browsingDrive}
            onClose={() => setBrowsingDrive(null)}
          />
        ) : browsingDrive.drive_type === "onedrive" ? (
          <OneDriveBrowser
            displayName={browsingDrive.display_name}
            onClose={() => setBrowsingDrive(null)}
          />
        ) : (
          <DriveBrowser
            drive={browsingDrive}
            onClose={() => {
                setBrowsingDrive(null);
                const newParams = new URLSearchParams(searchParams);
                newParams.delete("driveId");
                newParams.delete("folder");
                newParams.delete("filter");
                setSearchParams(newParams);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={`space-y-4 ${isDragOver ? "bg-blue-50 dark:bg-blue-950/20" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="fixed inset-0 bg-blue-500/20 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg border-2 border-dashed border-blue-500">
            <div className="text-center">
              <FileUp className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              {selectedFolder ? (
                <>
                  <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                    Drop files here to upload
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Files will be uploaded to:{" "}
                    {folders.find((f) => f.id === selectedFolder)?.name}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                    Select a folder first!
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Click on a folder before uploading files
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OAuth Processing Overlay */}
      {processingOAuth && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Connecting to Google Drive...</span>
            </div>
          </Card>
        </div>
      )}

      {/* Header with Title, Add Button, and Search */}
      <div className="rounded-[22px] border border-border/40 bg-card/85 backdrop-blur-md px-6 py-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-bold text-foreground">My Drive</h1>
            <div className="h-6 w-px bg-border/60" />
            <p className="text-sm text-muted-foreground font-semibold">
              Manage Drive
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Add Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-md shadow-blue-500/10 hover:shadow-blue-500/25 transition-all duration-300 active:scale-[0.98] shrink-0"
                  disabled={isRecycleBin}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 rounded-2xl p-1.5 border border-border/80 shadow-xl">
                <DropdownMenuItem className="rounded-xl px-3 py-2 font-medium" onSelect={handleFileUpload}>
                  <FileUp className="h-4 w-4 mr-2" />
                  {selectedFolder
                    ? "Upload to Current Folder"
                    : "Upload File (Select folder first)"}
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-xl px-3 py-2 font-medium" onSelect={handleCreateFolder}>
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Create Folder
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="rounded-xl px-3 py-2 font-medium">
                    <FileText className="h-4 w-4 mr-2" />
                    Google Docs
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="rounded-2xl p-1.5 border border-border/80 shadow-xl">
                    <DropdownMenuItem
                      className="rounded-xl px-3 py-2 font-medium"
                      onSelect={() =>
                        window.open(
                          "https://docs.new",
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                    >
                      Document
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="rounded-xl px-3 py-2 font-medium"
                      onSelect={() =>
                        window.open(
                          "https://sheets.new",
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                    >
                      Spreadsheet
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="rounded-xl px-3 py-2 font-medium"
                      onSelect={() =>
                        window.open(
                          "https://slides.new",
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                    >
                      Presentation
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="rounded-xl px-3 py-2 font-medium">
                    <FileText className="h-4 w-4 mr-2" />
                    MS Office Online
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="rounded-2xl p-1.5 border border-border/80 shadow-xl">
                    <DropdownMenuItem
                      className="rounded-xl px-3 py-2 font-medium"
                      onSelect={() =>
                        window.open(
                          "https://word.new",
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                    >
                      Word Document
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="rounded-xl px-3 py-2 font-medium"
                      onSelect={() =>
                        window.open(
                          "https://excel.new",
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                    >
                      Excel Spreadsheet
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="rounded-xl px-3 py-2 font-medium"
                      onSelect={() =>
                        window.open(
                          "https://powerpoint.new",
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                    >
                      PowerPoint
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator className="my-1" />
                {isAdmin && (
                  <DropdownMenuItem className="rounded-xl px-3 py-2 font-medium text-blue-500" onClick={() => setCompanyDriveDialogOpen(true)}>
                    <Server className="h-4 w-4 mr-2" />
                    Connect Company Drive
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Search */}
            <div className="relative w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter and search..."
                className="pl-9 bg-secondary/60 border-transparent hover:bg-secondary focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 rounded-xl transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Recycle Bin & Settings */}
            <Button variant="outline" className="gap-2 rounded-xl border-border/60 hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-500 transition-all font-semibold" onClick={handleRecycleBin}>
              <Trash2 className="h-4 w-4" />
              Recycle Bin
            </Button>
            <Button
              className="bg-gradient-to-tr from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-md shadow-violet-500/10 hover:shadow-violet-500/25 transition-all duration-300 active:scale-[0.98] gap-2"
              onClick={() => setPersonalDriveDialogOpen(true)}
            >
              <Cloud className="h-4 w-4" />
              Connect Drive
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl hover:bg-muted shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => setSettingsDialogOpen(true)}
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Connected Drives Section */}
      {!selectedFolder && !isRecycleBin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 mb-8">
          <CompanyDrivesList onBrowse={handleBrowseDrive} />
          <PersonalDrivesList onBrowse={handleBrowseDrive} />
        </div>
      )}

      {/* Secondary Header - Breadcrumb, Info, Sort, View Toggle */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span
            className="font-medium text-foreground cursor-pointer hover:underline"
            onClick={handleBackToRoot}
          >
            My Drive
          </span>
          {isRecycleBin && (
            <>
              <span>/</span>
              <span className="font-medium text-red-600 dark:text-red-400">
                Recycle Bin
              </span>
            </>
          )}
          {selectedFolder && (
            <>
              <span>/</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">
                {currentFolderName || "Loading..."}
              </span>
            </>
          )}
          {(displayFolders.length > 0 || displayFiles.length > 0) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs ml-2 hover:bg-primary"
              onClick={() =>
                handleSelectAll([...displayFolders, ...displayFiles])
              }
            >
              {selectedFiles.length > 0 &&
              selectedFiles.length ===
                displayFolders.length + displayFiles.length
                ? "Deselect All"
                : "Select All"}
            </Button>
          )}
        </div>

        {selectedFiles.length > 0 && (
          <div className="flex-1 mx-4 px-4 py-1.5 bg-primary/5 border border-primary/20 rounded-full flex items-center justify-between animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-primary px-2 py-0.5 bg-primary/10 rounded-full">
                {selectedFiles.length}
              </span>
              <span className="text-sm font-medium">Selected</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFiles([])}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {isRecycleBin ? (
                <>
                  <Button
                    size="sm"
                    onClick={() => {
                      bulkRestoreItems.mutate(selectedFiles);
                      setSelectedFiles([]);
                    }}
                    className="h-8 gap-2 bg-primary hover:bg-primary/90"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Restore
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setDeleteConfirmation({
                        id: "bulk",
                        name: `${selectedFiles.length} items`,
                        type: "file",
                        permanent: true,
                      });
                    }}
                    className="h-8 gap-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    bulkMoveToTrashItems.mutate(selectedFiles);
                    setSelectedFiles([]);
                  }}
                  className="h-8 gap-2 text-red-600 hover:bg-red-500 hover:text-white"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Move to Trash
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-4">
          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                {sortOptions.find((o) => o.value === sortBy)?.label}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {sortOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setSortBy(option.value)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View Toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-none rounded-l-md"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "compact" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-none border-x"
              onClick={() => setViewMode("compact")}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-none rounded-r-md"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      {/* Main Content Area */}
      {!selectedFolder ? (
        // Show root folders when no folder is selected
        <div className="space-y-6">
          {sortedFolders.length > 0 ? (
            <div className="mb-4">
              <h2 className="text-lg font-semibold mb-3">Folders</h2>
              {viewMode === "grid" ? (
                <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {sortedFolders.map((folder) => (
                    <Card
                      key={folder.id}
                      className="cursor-pointer hover:shadow-md transition-all group relative overflow-hidden"
                      onClick={() => handleFolderClick(folder.id, folder.name)}
                    >
                      <CardContent className="p-0">
                        <div className="relative">
                          {/* Folder visual */}
                          <div
                            className="h-24 rounded-t-lg relative"
                            style={{
                              backgroundColor:
                                folderColors[folder.color] ||
                                folderColors["folder-blue"],
                            }}
                          >
                            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background/20 to-transparent" />
                            <div className="absolute top-2 left-2 w-8 h-2 bg-white/30 rounded-full" />
                          </div>
                          {/* Folder tab */}
                          <div
                            className="absolute top-0 left-0 w-12 h-4 rounded-t-md -translate-y-1"
                            style={{
                              backgroundColor:
                                folderColors[folder.color] ||
                                folderColors["folder-blue"],
                            }}
                          />
                        </div>
                        {/* Selection Checkbox Overlay */}
                        <div
                          className={`absolute top-2 left-2 z-10  transition-opacity ${selectedFiles.includes(folder.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                          onClick={(e) => toggleSelection(folder.id, e)}
                        >
                          <div
                            className={`h-5 w-5 rounded-full bg-white border-2 flex items-center justify-center transition-colors ${selectedFiles.includes(folder.id) ? "bg-primary border-primary" : "bg-white/50 border-white hover:border-primary/50"}`}
                          >
                            {selectedFiles.includes(folder.id) && (
                              <CheckCircle2 className="h-3 w-3 text-primary" />
                            )}
                          </div>
                        </div>
                        <div className="p-3 bg-card">
                          <p className="font-medium text-sm truncate">
                            {folder.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {folder.file_count} files •{" "}
                            {formatFileSize(folder.total_size)}
                          </p>
                        </div>
                        {/* Menu button */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 hover:bg-white"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem
                              onClick={() =>
                                handleFolderClick(folder.id, folder.name)
                              }
                            >
                              Open
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                toast.success(`Renaming ${folder.name}`)
                              }
                            >
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                toast.success(`Sharing ${folder.name}`)
                              }
                            >
                              Share
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmation({
                                  id: folder.id,
                                  name: folder.name,
                                  type: "folder",
                                  permanent: isRecycleBin,
                                });
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {isRecycleBin ? "Delete Permanently" : "Delete"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {sortedFolders.map((folder) => (
                        <div
                          key={folder.id}
                          className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() =>
                            handleFolderClick(folder.id, folder.name)
                          }
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="shrink-0 transition-opacity"
                              onClick={(e) => toggleSelection(folder.id, e)}
                            >
                              <div
                                className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${selectedFiles.includes(folder.id) ? "bg-primary border-primary" : "bg-muted-foreground/20 border-transparent hover:border-primary/50"}`}
                              >
                                {selectedFiles.includes(folder.id) && (
                                  <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                                )}
                              </div>
                            </div>
                            <div
                              className="p-2 rounded-lg"
                              style={{
                                backgroundColor:
                                  folderColors[folder.color] ||
                                  folderColors["folder-blue"],
                              }}
                            >
                              <FolderOpen className="h-5 w-5 text-primary-foreground" />
                            </div>
                            <div>
                              <p className="font-medium">{folder.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {folder.file_count} files •{" "}
                                {formatFileSize(folder.total_size)}
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">
                  No folders found matching your search.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Root Files Section */}
          {sortedFiles.length > 0 && (
            <div className="mb-4">
              <h2 className="text-lg font-semibold mb-3">Files</h2>
              {viewMode === "grid" ? (
                <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {sortedFiles.map((file) => (
                    <Card
                      key={file.id}
                      className="group relative cursor-pointer hover:shadow-sm transition-all"
                    >
                      <CardContent className="p-3">
                        <div className="flex flex-col items-center text-center space-y-2">
                          {file.mime_type?.startsWith("image/") &&
                          file.file_url ? (
                            <div className="w-12 h-12 overflow-hidden rounded-lg flex items-center justify-center shrink-0">
                              <img
                                src={getFileUrl(file.file_url)}
                                alt={file.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center shrink-0">
                              {getFileIcon(file.mime_type)}
                            </div>
                          )}

                          <div className="w-full min-w-0">
                            <p
                              className="font-medium text-sm truncate"
                              title={file.name}
                            >
                              {file.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {formatFileSize(file.file_size)}
                            </p>
                          </div>
                        </div>

                        {/* Selection Checkbox */}
                        <div
                          className={`absolute top-2 left-2 z-10 transition-opacity
                               ${
                                 selectedFiles.includes(file.id)
                                   ? "opacity-100"
                                   : "opacity-0 group-hover:opacity-100"
                               }`}
                          onClick={(e) => toggleSelection(file.id, e)}
                        >
                          <div
                            className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all
                               ${
                                 selectedFiles.includes(file.id)
                                   ? "bg-primary border-primary"
                                   : "bg-white/70 border-white group-hover:bg-primary group-hover:border-primary"
                               }`}
                          >
                            <CheckCircle2
                              className={`h-3 w-3 transition-opacity
                               ${
                                 selectedFiles.includes(file.id)
                                   ? "opacity-100 text-white"
                                   : "opacity-0"
                               }`}
                            />
                          </div>
                        </div>

                        {/* 3 dots menu */}
                        <div className="absolute top-2 right-2 opacity-60 hover:opacity-100 transition-opacity">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 bg-white/80 dark:bg-slate-800/80"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFileClick(
                                    file.name,
                                    file.file_url,
                                    file.mime_type || "",
                                    file.id,
                                  );
                                }}
                              >
                                Open
                              </DropdownMenuItem>

                              {isRecycleBin ? (
                                <>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      restoreFile.mutate(file.id);
                                    }}
                                  >
                                    <Undo2 className="h-4 w-4 mr-2" />
                                    Restore
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    className="text-red-600 focus:text-red-600"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirmation({
                                        id: file.id,
                                        name: file.name,
                                        type: "file",
                                        permanent: true,
                                      });
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmation({
                                      id: file.id,
                                      name: file.name,
                                      type: "file",
                                    });
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {sortedFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() =>
                            handleFileClick(
                              file.name,
                              file.file_url,
                              file.mime_type || "",
                              file.id,
                            )
                          }
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            {file.mime_type?.startsWith("image/") &&
                            file.file_url ? (
                              <div className="w-8 h-8 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
                                <img
                                  src={getFileUrl(file.file_url)}
                                  alt={file.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center shrink-0">
                                {getFileIcon(file.mime_type)}
                              </div>
                            )}
                            <div
                              className="shrink-0 transition-opacity"
                              onClick={(e) => toggleSelection(file.id, e)}
                            >
                              <div
                                className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${selectedFiles.includes(file.id) ? "bg-primary border-primary" : "bg-muted-foreground/20 border-transparent hover:border-primary/50"}`}
                              >
                                {selectedFiles.includes(file.id) && (
                                  <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                                )}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {file.name}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">
                                {formatFileSize(file.file_size)} •{" "}
                                {formatDate(file.created_at)}
                              </p>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFileClick(
                                    file.name,
                                    file.file_url,
                                    file.mime_type || "",
                                    file.id,
                                  );
                                }}
                              >
                                Open
                              </DropdownMenuItem>
                              {isRecycleBin ? (
                                <>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      restoreFile.mutate(file.id);
                                    }}
                                  >
                                    <Undo2 className="h-4 w-4 mr-2" />
                                    Restore
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-red-600 focus:text-red-600"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirmation({
                                        id: file.id,
                                        name: file.name,
                                        type: "file",
                                        permanent: true,
                                      });
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Permanently
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmation({
                                      id: file.id,
                                      name: file.name,
                                      type: "file",
                                    });
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      ) : (
        // Show folder contents when a folder is selected
        <div className="space-y-6">
          {/* Folder Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedFolder(null)}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl font-semibold">
                  {folders.find((f) => f.id === selectedFolder)?.name ||
                    "Folder"}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isRecycleBin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload Files
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setViewMode(viewMode === "grid" ? "list" : "grid")
                }
              >
                {viewMode === "grid" ? (
                  <List className="h-4 w-4" />
                ) : (
                  <Grid3X3 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Files Display */}
          {sortedFiles.length > 0 ? (
            viewMode === "grid" ? (
              <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {sortedFiles.map((file) => (
                  <Card
                    key={file.id}
                    className="cursor-pointer hover:shadow-md transition-all group relative"
                    onClick={() =>
                      handleFileClick(
                        file.name,
                        file.file_url,
                        file.mime_type || "",
                        file.id,
                      )
                    }
                  >
                    <CardContent className="p-3">
                      <div className="flex flex-col items-center text-center space-y-2">
                        {file.mime_type?.startsWith("image/") &&
                        file.file_url ? (
                          <div className="w-12 h-12 overflow-hidden rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <img
                              src={getFileUrl(file.file_url)}
                              alt={file.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center shrink-0">
                            {getFileIcon(file.mime_type)}
                          </div>
                        )}
                        <div className="w-full min-w-0">
                          <p
                            className="font-medium text-sm truncate"
                            title={file.name}
                          >
                            {file.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {formatFileSize(file.file_size)}
                          </p>
                        </div>
                      </div>

                      {/* Selection Checkbox Overlay */}
                      <div
                        className={`absolute top-2 left-2 z-10 transition-opacity ${selectedFiles.includes(file.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                        onClick={(e) => toggleSelection(file.id, e)}
                      >
                        <div
                          className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${selectedFiles.includes(file.id) ? "bg-primary border-primary" : "bg-white/50 border-white hover:border-primary/50"}`}
                        >
                          {selectedFiles.includes(file.id) && (
                            <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                      </div>

                      {/* File actions menu */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 bg-white/80 hover:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-800"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFileClick(
                                  file.name,
                                  file.file_url,
                                  file.mime_type || "",
                                  file.id,
                                );
                              }}
                            >
                              Open
                            </DropdownMenuItem>
                            {!isRecycleBin && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(file.name, file.file_url);
                                }}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {isRecycleBin ? (
                              <>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    restoreFile.mutate(file.id);
                                  }}
                                >
                                  <Undo2 className="h-4 w-4 mr-2" />
                                  Restore
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmation({
                                      id: file.id,
                                      name: file.name,
                                      type: "file",
                                      permanent: true,
                                    });
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Permanently
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmation({
                                    id: file.id,
                                    name: file.name,
                                    type: "file",
                                  });
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {sortedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() =>
                          handleFileClick(
                            file.name,
                            file.file_url,
                            file.mime_type || "",
                            file.id,
                          )
                        }
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          {file.mime_type?.startsWith("image/") &&
                          file.file_url ? (
                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
                              <img
                                src={getFileUrl(file.file_url)}
                                alt={file.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center shrink-0">
                              {getFileIcon(file.mime_type)}
                            </div>
                          )}
                          <div
                            className="shrink-0 transition-opacity"
                            onClick={(e) => toggleSelection(file.id, e)}
                          >
                            <div
                              className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${selectedFiles.includes(file.id) ? "bg-primary border-primary" : "bg-muted-foreground/20 border-transparent hover:border-primary/50"}`}
                            >
                              {selectedFiles.includes(file.id) && (
                                <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                              )}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{file.name}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {formatFileSize(file.file_size)} •{" "}
                              {formatDate(file.created_at)}
                            </p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFileClick(
                                  file.name,
                                  file.file_url,
                                  file.mime_type || "",
                                  file.id,
                                );
                              }}
                            >
                              Open
                            </DropdownMenuItem>
                            {!isRecycleBin && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(file.name, file.file_url);
                                }}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {isRecycleBin ? (
                              <>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    restoreFile.mutate(file.id);
                                  }}
                                >
                                  <Undo2 className="h-4 w-4 mr-2" />
                                  Restore
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmation({
                                      id: file.id,
                                      name: file.name,
                                      type: "file",
                                      permanent: true,
                                    });
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Permanently
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmation({
                                    id: file.id,
                                    name: file.name,
                                    type: "file",
                                  });
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          ) : (
            <Card className="border-dashed border-2">
              <CardContent className="p-12 text-center">
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                    <FolderOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      {isRecycleBin
                        ? "Recycle Bin is empty"
                        : "This folder is empty"}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {isRecycleBin
                        ? "Items you delete will appear here for 30 days"
                        : "Upload files to get started organizing your content"}
                    </p>
                    {!isRecycleBin && (
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        className="gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        Upload Your First File
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Status Bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 px-4 py-2 rounded-lg">
        <div className="flex items-center gap-4">
          {selectedFolder ? (
            <>
              <span>
                Viewing folder:{" "}
                {folders.find((f) => f.id === selectedFolder)?.name}
              </span>
              <span>{sortedFiles.length} files</span>
            </>
          ) : (
            <>
              <span>{sortedFolders.length} folders</span>
              {searchQuery && <span>Filtered by: "{searchQuery}"</span>}
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>
            {selectedFolder
              ? "Upload files to this folder using the upload button"
              : ""}
          </span>
        </div>
      </div>

      {/* File Preview Dialog */}
      {previewFile && (
        <Dialog
          open={!!previewFile}
          onOpenChange={(open) => !open && setPreviewFile(null)}
        >
          <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate pr-4 text-base font-semibold">
                  {previewFile.name}
                </DialogTitle>
                <p className="text-xs text-muted-foreground truncate">
                  {previewFile.mimeType}
                </p>
              </div>
              <div className="flex items-center gap-2 pr-8">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2"
                  onClick={() =>
                    handleDownload(
                      previewFile.name,
                      previewFile.url.replace(
                          import.meta.env.VITE_API_URL?.replace("/api", "") || import.meta.env.VITE_APP_URL || "http://localhost:4000",
                        "",
                      ),
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                  onClick={() => {
                    setDeleteConfirmation({
                      id: previewFile.id,
                      name: previewFile.name,
                      type: "file",
                      permanent: isRecycleBin,
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  {isRecycleBin ? "Delete Permanently" : "Delete"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setPreviewFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-hidden bg-muted/20 flex flex-col">
              {isTextLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
                  <p className="text-muted-foreground animate-pulse">
                    Loading file content...
                  </p>
                </div>
              ) : previewText !== null ? (
                <div className="flex-1 overflow-auto p-6">
                  <pre className="bg-card text-card-foreground p-6 rounded-xl border border-border/50 shadow-sm font-mono text-sm leading-relaxed whitespace-pre-wrap break-all overflow-x-auto ring-1 ring-inset ring-white/10">
                    {previewText}
                  </pre>
                </div>
              ) : previewFile.mimeType.startsWith("image/") ? (
                <div className="flex-1 overflow-auto flex items-center justify-center p-4">
                  <img
                    src={previewFile.url}
                    alt={previewFile.name}
                    className="max-w-full max-h-full object-contain shadow-2xl rounded-sm transition-all duration-300"
                  />
                </div>
              ) : previewFile.mimeType === "application/pdf" ? (
                <iframe
                  src={previewFile.url}
                  className="w-full h-full border-none shadow-inner bg-white"
                  title={previewFile.name}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                  <div className="relative mb-6">
                    <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center transform rotate-3 transition-transform hover:rotate-0">
                      <File className="h-10 w-10 text-primary" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-background border-4 border-muted/20 rounded-full flex items-center justify-center">
                      <Settings className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    No preview available
                  </h3>
                  <p className="text-muted-foreground max-w-xs mb-8">
                    We can't preview this file type directly, but you can
                    download it or try opening it in a new tab.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant="default"
                      onClick={() => window.open(previewFile.url, "_blank")}
                      className="gap-2"
                    >
                      Open in New Tab
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        handleDownload(
                          previewFile.name,
                          previewFile.url.replace(
                              import.meta.env.VITE_API_URL?.replace("/api", "") || import.meta.env.VITE_APP_URL || "http://localhost:4000",
                            "",
                          ),
                        )
                      }
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialogs */}
      <CreateFolderDialog
        open={createFolderDialogOpen}
        onOpenChange={setCreateFolderDialogOpen}
        onCreateFolder={handleCreateFolderSubmit}
      />
      <ConnectCompanyDriveDialog
        open={companyDriveDialogOpen}
        onOpenChange={setCompanyDriveDialogOpen}
      />
      <ConnectPersonalDriveDialog
        open={personalDriveDialogOpen}
        onOpenChange={setPersonalDriveDialogOpen}
        connectedDrives={(allDrives ?? [])
          .filter((d) => d.ownership === "personal")
          .map((d) => d.drive_type)}
        onBrowse={handleBrowseDrive}
      />
      <DriveSettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
      />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0 && selectedFolder) {
            const folderName =
              folders.find((f) => f.id === selectedFolder)?.name ||
              "Selected folder";
            Array.from(files).forEach((file) => {
              uploadFile.mutate({ file, folderId: selectedFolder });
            });
            toast.success(`Uploading ${files.length} file(s) to ${folderName}`);
          } else if (!selectedFolder) {
            toast.error("Please select a folder first by clicking on it!");
          }
          // Reset the input value so the same file can be selected again
          e.target.value = "";
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteConfirmation}
        onOpenChange={(open) => !open && setDeleteConfirmation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              {deleteConfirmation?.permanent
                ? "Permanently Delete?"
                : "Move to Trash?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmation?.permanent
                ? `Are you sure you want to permanently delete "${deleteConfirmation?.name}"? This action cannot be undone.`
                : `Are you sure you want to move "${deleteConfirmation?.name}" to the Recycle Bin?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className={
                deleteConfirmation?.permanent
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }
            >
              {deleteConfirmation?.permanent
                ? "Delete Permanently"
                : "Move to Trash"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
