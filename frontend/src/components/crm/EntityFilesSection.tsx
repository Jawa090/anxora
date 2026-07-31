import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  File,
  FileText,
  FileSpreadsheet,
  Image,
  Video,
  Music,
  Archive,
  Folder,
  Download,
  Trash2,
  Loader2,
  Upload,
} from "lucide-react";
import { useDocuments, useUploadDocument, useDeleteDocument } from "@/hooks/useCrmInteractions";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface EntityFilesSectionProps {
  entityType: string;
  entityId: string;
}

export function EntityFilesSection({ entityType, entityId }: EntityFilesSectionProps) {
  const { data: files, isLoading } = useDocuments(entityType, entityId);
  const uploadDocument = useUploadDocument();
  const deleteDocument = useDeleteDocument();
  const { profile, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    if (!user?.id) {
      toast.error(`You must be logged in. (user: ${JSON.stringify(user)})`);
      return;
    }

    if (!profile?.org_id) {
      toast.error(`Org missing. Profile: ${JSON.stringify(profile)}`);
      return;
    }

    try {
      for (const file of Array.from(selectedFiles)) {
        await uploadDocument.mutateAsync({
          entityType,
          entityId,
          file,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = async (file: { file_path: string; file_name: string }) => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || import.meta.env.VITE_APP_URL || "http://localhost:4000";
      const downloadUrl = `${baseUrl}${file.file_path}`;
      
      // Create a temporary link and click it to trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', file.file_name);
      link.setAttribute('target', '_blank');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Download started");
    } catch (error: any) {
      toast.error(error.message || "Failed to download");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this document?")) {
      deleteDocument.mutate({ id, entityType, entityId });
    }
  };

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <File className="h-4 w-4 text-muted-foreground" />;
    const type = mimeType.toLowerCase();
    if (type.startsWith("image/")) return <Image className="h-4 w-4 text-emerald-500" />;
    if (type.startsWith("video/")) return <Video className="h-4 w-4 text-purple-500" />;
    if (type.startsWith("audio/")) return <Music className="h-4 w-4 text-pink-500" />;
    if (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv")) return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
    if (type === "application/pdf") return <FileText className="h-4 w-4 text-red-500" />;
    if (type.includes("document") || type.includes("word")) return <FileText className="h-4 w-4 text-blue-500" />;
    if (type.includes("zip") || type.includes("archive") || type.includes("compressed")) return <Archive className="h-4 w-4 text-muted-foreground" />;
    if (type.includes("folder")) return <Folder className="h-4 w-4 text-amber-500" />;
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  const formatSize = (bytes: number | string | null) => {
    if (!bytes) return "";
    const numBytes = typeof bytes === 'string' ? parseInt(bytes) : bytes;
    if (numBytes < 1024) return `${numBytes} B`;
    if (numBytes < 1024 * 1024) return `${(numBytes / 1024).toFixed(1)} KB`;
    if (numBytes < 1024 * 1024 * 1024) return `${(numBytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(numBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  return (
    <Collapsible defaultOpen className="group/collapsible">
      <div className="border border-border rounded-lg bg-card overflow-hidden transition-all hover:shadow-sm">
        <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Documents & Attachments
            </span>
            {files && files.length > 0 && (
              <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {files.length}
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <Folder className="h-3 w-3 text-muted-foreground" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3">
            <div className="max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
                  <span className="text-xs text-muted-foreground animate-pulse">Loading documents...</span>
                </div>
              ) : files && files.length > 0 ? (
                <div className="space-y-1">
                  {files.map((file: any) => (
                    <div key={file.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-transparent hover:border-border hover:bg-muted/30 transition-all group/item">
                      <div className="p-2 rounded-md bg-muted group-hover/item:bg-background transition-colors">
                        {getFileIcon(file.mime_type || file.file_name?.split('.').pop())}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate group-hover/item:text-primary transition-colors">
                          {file.file_name}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          <span>{formatSize(file.file_size)}</span>
                          <span className="w-1 h-1 rounded-full bg-border" />
                          <span>{file.user_name || 'System'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-all translate-x-2 group-hover/item:translate-x-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                          onClick={() => handleDownload(file)}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDelete(file.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-muted rounded-xl bg-muted/10">
                  <File className="h-10 w-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">No documents attached</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Upload files related to this record</p>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-border/50">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="default"
                size="sm"
                className="w-full h-10 font-bold shadow-sm hover:translate-y-[-1px] transition-all"
                onClick={handleUploadClick}
                disabled={uploadDocument.isPending}
              >
                {uploadDocument.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {uploadDocument.isPending ? "Uploading Files..." : "Upload New Document"}
              </Button>
              <p className="text-[10px] text-center text-muted-foreground mt-2">
                Supported formats: PDF, DOCX, XLSX, Images (Max 20MB)
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
