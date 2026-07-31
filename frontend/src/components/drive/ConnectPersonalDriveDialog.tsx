import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Cloud, CheckCircle2 } from "lucide-react";
import { useCreateDrive, useDeleteDrive, useConnectedDrives } from "@/hooks/useDrives";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { googleDriveService } from "@/services/googleDriveService";
import { oneDriveService } from "@/services/oneDriveService";
import { toast } from "sonner";

const personalDriveTypes = [
  {
    id: "google_drive",
    name: "Google Drive",
    icon: Cloud,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
  // {
  //   id: "onedrive",
  //   name: "OneDrive",
  //   icon: Cloud,
  //   color: "text-blue-500",
  //   bgColor: "bg-blue-500/10",
  // },
  // {
  //   id: "icloud",
  //   name: "iCloud",
  //   icon: Cloud,
  //   color: "text-sky-400",
  //   bgColor: "bg-sky-400/10",
  // },
];

interface ConnectPersonalDriveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectedDrives?: string[];
  onBrowse?: (drive: any) => void;
}

export function ConnectPersonalDriveDialog({
  open,
  onOpenChange,
  connectedDrives = [],
  onBrowse,
}: ConnectPersonalDriveDialogProps) {
  const [connecting, setConnecting] = useState<string | null>(null);
  const { user, profile } = useAuth();
  const { organization } = useOrganization();
  const createDrive = useCreateDrive();
  const deleteDrive = useDeleteDrive();
  const { data: personalDrives } = useConnectedDrives("personal");

  const getConnectedDriveId = (driveTypeId: string) =>
    personalDrives?.find((d) => d.drive_type === driveTypeId)?.id;

  const handleDisconnect = async (driveTypeId: string) => {
    const driveId = getConnectedDriveId(driveTypeId);
    if (!driveId) return;
    await deleteDrive.mutateAsync(driveId);
  };

  const handleConnect = async (driveId: string) => {
    if (!user || !profile?.org_id) {
      console.warn("User or Org session missing:", { user: !!user, org: !!profile?.org_id });
      toast.error("You must be logged in to connect a drive");
      return;
    }

    console.log("Initiating connection for drive type:", driveId);
    setConnecting(driveId);

    try {
      if (driveId === "google_drive") {
        console.log("Fetching Google Auth URL...");
        try {
          const authUrl = await googleDriveService.getAuthUrl(
            "",
            "", // No driveId yet, will insert in callback
            "personal",
          );
          window.location.href = authUrl;
        } catch (err: any) {
          toast.error(err.message || "Failed to initiate Google Sign-In");
          setConnecting(null);
        }
        return;
      }

      if (driveId === "onedrive") {
        try {
          const authUrl = await oneDriveService.getAuthUrl();
          window.location.href = authUrl;
        } catch (err: any) {
          toast.error(err.message || "Failed to start OneDrive authentication");
          setConnecting(null);
        }
        return;
      }

      toast.info(
        `${personalDriveTypes.find((d) => d.id === driveId)?.name} connection coming soon!`,
      );
      setConnecting(null);
    } catch (error) {
      console.error("Error connecting drive:", error);
      toast.error("Failed to connect drive");
      setConnecting(null);
    }
  };

  const isConnected = (driveId: string) => connectedDrives.includes(driveId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect Personal Drive</DialogTitle>
          <DialogDescription>
            Connect your personal cloud storage to access your files.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {personalDriveTypes.map((drive) => {
            const Icon = drive.icon;
            const currentDrive = personalDrives?.find((d) => d.drive_type === drive.id);
            const connected = !!currentDrive;
            const isConnecting = connecting === drive.id;

            return (
              <div
                key={drive.id}
                className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                  connected
                    ? "border-green-500/50 bg-green-500/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${drive.bgColor}`}>
                    {drive.id === "google_drive" ? (
                      <img
                        src="https://www.gstatic.com/images/branding/product/2x/drive_2020q4_48dp.png"
                        alt="Google Drive"
                        className="h-5 w-5"
                      />
                    ) : (
                      <Icon className={`h-5 w-5 ${drive.color}`} />
                    )}
                  </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">
                          {connected && currentDrive?.display_name
                            ? currentDrive.display_name
                            : drive.name}
                        </p>
                        {connected && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-5 px-1.5 text-[10px] border-primary/50 text-primary hover:bg-primary hover:text-white rounded-md"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (currentDrive && currentDrive.is_active && onBrowse) {
                                onBrowse(currentDrive);
                                onOpenChange(false);
                              } else {
                                toast.error("This drive is not yet connected. Please authenticate first.");
                              }
                            }}
                          >
                            Open
                          </Button>
                        )}
                      </div>
                      {connected && currentDrive && (
                        <div className="flex flex-col gap-0.5">
                          <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                            {drive.name}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                              Connected
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-primary/10 text-primary">
                              OAuth
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {connected ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="bg-red-500/20 text-red-600 hover:bg-red-600 hover:text-white border-none h-7 px-2 text-xs"
                      onClick={() => handleDisconnect(drive.id)}
                      disabled={deleteDrive.isPending}
                    >
                      {deleteDrive.isPending ? "Logging Out..." : "Log Out"}
                    </Button>
                  ) : (
                  <Button
                    size="sm"
                    onClick={() => handleConnect(drive.id)}
                    disabled={isConnecting}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4"
                  >
                    {isConnecting ? (
                      "Connecting..."
                    ) : drive.id === "google_drive" ? (
                      <div className="flex items-center gap-2">
                        Connect
                      </div>
                    ) : (
                      "Connect"
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
