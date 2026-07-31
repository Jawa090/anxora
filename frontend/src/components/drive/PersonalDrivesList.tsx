import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Cloud, Server, MoreVertical, Settings, Trash2, Loader2, FolderOpen, Link } from "lucide-react";
import { useConnectedDrives, useDeleteDrive, useCreateDrive, ConnectedDrive, DriveType } from "@/hooks/useDrives";
import { useOneDriveConnection } from "@/hooks/useOneDriveConnection";
import { googleDriveService } from "@/services/googleDriveService";
import { oneDriveService } from "@/services/oneDriveService";
import { toast } from "sonner";
import { useCustomDialog } from "@/contexts/DialogContext";
import { useNavigate } from "react-router-dom";

const driveTypeIcons: Record<string, { icon: typeof Cloud; color: string }> = {
  google_drive: { icon: Cloud, color: "text-red-500" },
  onedrive: { icon: Cloud, color: "text-blue-500" },
  icloud: { icon: Cloud, color: "text-sky-400" },
  network_smb: { icon: Server, color: "text-orange-500" },
  network_nfs: { icon: Server, color: "text-amber-500" },
  network_webdav: { icon: Server, color: "text-yellow-500" },
  network_sftp: { icon: Server, color: "text-purple-500" },
};

const driveTypeLabels: Record<string, string> = {
  google_drive: "Google Drive",
  onedrive: "OneDrive",
  icloud: "iCloud",
  network_smb: "SMB",
  network_nfs: "NFS",
  network_webdav: "WebDAV",
  network_sftp: "SFTP",
};

interface PersonalDrivesListProps {
  onBrowse?: (drive: ConnectedDrive) => void;
}

export function PersonalDrivesList({ onBrowse }: PersonalDrivesListProps) {
  const { data: drives, isLoading } = useConnectedDrives("personal");
  const { data: oneDriveConn } = useOneDriveConnection();
  const { confirm } = useCustomDialog();
  const deleteDrive = useDeleteDrive();
  const createDrive = useCreateDrive();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!drives || drives.length === 0) {
    return null;
  }

  const handleDelete = async (driveId: string) => {
    if (await confirm("Are you sure you want to log out of this personal drive?", { variant: 'destructive', title: 'Log Out Personal Drive' })) {
      await deleteDrive.mutateAsync(driveId);
    }
  };

  const handleInternalConnect = async (type: DriveType) => {
    try {
      // First, create the drive record so we have a driveId
      const newDrive = await createDrive.mutateAsync({
        ownership: "personal",
        drive_type: type,
        display_name: `My ${driveTypeLabels[type] || "Drive"}`,
      });

      if (type === "google_drive") {
        const authUrl = await googleDriveService.getAuthUrl("", newDrive.id, newDrive.ownership);
        window.location.href = authUrl;
      } else if (type === "onedrive") {
        const authUrl = await oneDriveService.getAuthUrl();
        window.location.href = authUrl;
      } else {
        toast.info("OAuth for this provider is not yet implemented");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to start authentication");
    }
  };

  const handleConnect = async (drive: ConnectedDrive) => {
    handleInternalConnect(drive.drive_type);
  };

  const isConnected = (drive: ConnectedDrive) => {
    const isNetworkDrive = ["network_smb", "network_nfs", "network_webdav", "network_sftp"].includes(drive.drive_type);
    if (isNetworkDrive) return true;
    if (drive.drive_type === "onedrive") return !!oneDriveConn?.access_token;
    return !!drive.access_token;
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">My Personal Drives</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-6">
          {(() => {
            const availableTypes = ["google_drive", "onedrive"];
            const driveMap = new Map((drives || []).map(d => [d.drive_type, d]));
            
            const connectedItems: any[] = [];
            const availableItems: any[] = [];

            availableTypes.forEach((type) => {
              const drive = driveMap.get(type as any);
              const connected = drive ? isConnected(drive) : false;
              
              if (connected && drive) {
                connectedItems.push({ type, drive, connected });
              } else {
                availableItems.push({ type, drive, connected: false });
              }
            });

            const renderCard = (type: string, drive: ConnectedDrive | undefined, connected: boolean) => {
              const typeInfo = driveTypeIcons[type] || { icon: Cloud, color: "text-muted-foreground" };
              const Icon = typeInfo.icon;

              return (
                <div
                  key={type}
                  onClick={() => {
                    if (connected && drive) {
                      navigate(`/collaboration/drive/personal/${drive.id}`);
                    }
                  }}
                  className={`flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 border rounded-xl transition-all ${
                    connected ? "cursor-pointer hover:shadow-md hover:border-primary/30" : ""
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="h-10 w-10 shrink-0 flex items-center justify-center">
                      {type === "google_drive" ? (
                        <div className="shrink-0">
                          <svg viewBox="0 0 24 24" className="w-9 h-9">
                            <path d="M7.7 15.5l3.8 6.7L1.4 22.2l3.8-6.7z" fill="#0066DA" />
                            <path d="M5.2 11.2l3.8-6.7 13.6 0-3.8 6.7-13.6 0z" fill="#00AC47" />
                            <path d="M11.5 11.2l3.8 6.7-7.6 0-3.8-6.7 7.6 0z" fill="#EA4335" />
                            <path d="M15.3 4.5l3.8 6.7-7.6 0-3.8-6.7 7.6 0z" fill="#FFBC00" />
                            <path d="M11.5 11.2l7.6 0-3.8 6.7-7.6-6.7z" fill="#00832D" />
                            <path d="M15.3 4.5l3.8 6.7 3.8-6.7-7.6 0z" fill="#2684FC" />
                          </svg>
                        </div>
                      ) : type === "onedrive" ? (
                        <img
                          src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Microsoft_Office_OneDrive_%282019%E2%80%93present%29.svg"
                          alt="OneDrive"
                          className="h-10 w-10 object-contain"
                        />
                      ) : (
                        <div className="h-10 w-10 bg-muted rounded-md flex items-center justify-center">
                          <Icon className={`h-6 w-6 ${typeInfo.color}`} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex flex-col">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-base text-foreground truncate">
                            {drive ? drive.display_name : (type === "google_drive" ? "Google Drive" : "OneDrive")}
                          </p>
                          {isConnected(drive!) && onBrowse && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-5 px-1.5 text-[10px] border-primary/50 text-primary hover:bg-primary hover:text-white rounded-md"
                              onClick={(e) => {
                                e.stopPropagation();
                                onBrowse(drive!);
                              }}
                            >
                              Open
                            </Button>
                          )}
                        </div>
                        {connected && drive && (
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              {type === "google_drive" ? "Google Drive" : "OneDrive"}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                              OAuth
                            </span>
                            <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                            <span className="text-[10px] text-emerald-600 font-medium">Synced</span>
                          </div>
                        )}
                        {!connected && (
                          <p className="text-xs text-muted-foreground">
                            {type === "google_drive" ? "Connect your Google account" : "Connect your Microsoft account"}
                          </p>
                        )}
                      </div>
                    </div>

                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {connected && drive ? (
                      <Button 
                        onClick={() => handleDelete(drive.id)} 
                        variant="ghost"
                        className="text-destructive text-xs bg-red-500/20 hover:bg-destructive hover:text-destructive-foreground px-2 h-7"
                      >
                        Log Out
                      </Button>
                    ) : (
                      <Button 
                        onClick={() => handleInternalConnect(type as any)} 
                        disabled={createDrive.isPending}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 h-8 text-xs font-medium"
                      >
                        {createDrive.isPending ? "Connecting..." : "Connect"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            };

            return (
              <>
                {connectedItems.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider pl-1">
                      Connected Drives
                    </h3>
                    <div className="grid gap-3">
                      {connectedItems.map(item => renderCard(item.type, item.drive, true))}
                    </div>
                  </div>
                )}

              </>
            );
          })()}
        </div>
      </CardContent>
    </Card>
  );
}
