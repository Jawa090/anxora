import { useQuery, useMutation, useQueryClient, RefetchOptions } from '@tanstack/react-query';
import { driveApi } from '../lib/api';
import { toast } from 'sonner';

export interface DriveFile {
  id: string;
  name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
  mime_type?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  org_id: string;
  parent_folder_id: string | null;
  created_by: string;
  color: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
  file_count?: number;
  total_size?: number;
}

export interface DriveActivity {
  id: string;
  activity_type: string;
  activity_data: any;
  created_at: string;
  user_name: string;
  file_name: string | null;
  folder_name: string | null;
}

// Hook for folders
export function useDriveFolders(parentId?: string, trash?: boolean) {
  const queryClient = useQueryClient();

  const foldersQuery = useQuery({
    queryKey: ['drive-folders', parentId, trash],
    queryFn: () => driveApi.getFolders(parentId, trash),
    staleTime: 30000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData: any) => previousData,
  });

  const createFolder = useMutation({
    mutationFn: (data: { name: string; parent_folder_id?: string; color?: string }) =>
      driveApi.createFolder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-folders'] });
      toast.success('Folder created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create folder');
    },
  });

  const deleteFolder = useMutation({
    mutationFn: (id: string) => driveApi.deleteFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-folders'] });
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
      toast.success('Folder and contents moved to trash');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete folder');
    },
  });

  const permanentDeleteFolder = useMutation({
    mutationFn: (id: string) => driveApi.permanentDeleteFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-folders'] });
      toast.success('Folder permanently deleted');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to permanently delete folder');
    },
  });

  const restoreFolder = useMutation({
    mutationFn: (id: string) => driveApi.restoreFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-folders'] });
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
      toast.success('Folder and its contents restored');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to restore folder');
    },
  });

  return {
    folders: foldersQuery.data || [],
    isLoading: foldersQuery.isLoading,
    error: foldersQuery.error,
    createFolder,
    deleteFolder,
    restoreFolder,
    permanentDeleteFolder,
    refetch: foldersQuery.refetch,
  };
}

// Hook for files
export function useDriveFiles(folderId?: string, recent?: boolean, trash?: boolean) {
  const queryClient = useQueryClient();

  const filesQuery = useQuery({
    queryKey: ['drive-files', folderId, recent, trash],
    queryFn: () => driveApi.getFiles(folderId, recent, trash),
    staleTime: 30000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData: any) => previousData,
  });

  const uploadFile = useMutation({
    mutationFn: ({ file, folderId }: { file: File; folderId?: string }) => {
      console.log('Uploading file:', file.name, 'to folder:', folderId);
      return driveApi.uploadFile(file, folderId);
    },
    onSuccess: (data) => {
      console.log('Upload successful:', data);
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
      queryClient.invalidateQueries({ queryKey: ['drive-folders'] });
      toast.success('File uploaded successfully');
    },
    onError: (error: any) => {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload file');
    },
  });

  const deleteFile = useMutation({
    mutationFn: (id: string) => driveApi.deleteFile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
      queryClient.invalidateQueries({ queryKey: ['drive-folders'] });
      toast.success('File moved to trash');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete file');
    },
  });

  const restoreFile = useMutation({
    mutationFn: (id: string) => driveApi.restoreFile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
      queryClient.invalidateQueries({ queryKey: ['drive-folders'] });
      toast.success('File restored successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to restore file');
    },
  });

  const permanentDeleteFile = useMutation({
    mutationFn: (id: string) => driveApi.permanentDeleteFile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
      queryClient.invalidateQueries({ queryKey: ['drive-folders'] });
      toast.success('File permanently deleted');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to permanently delete file');
    },
  });

  const bulkRestoreItems = useMutation({
    mutationFn: (ids: string[]) => driveApi.bulkRestore(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
      queryClient.invalidateQueries({ queryKey: ['drive-folders'] });
      toast.success('Selected items restored');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to restore items');
    },
  });

  const bulkMoveToTrashItems = useMutation({
    mutationFn: (ids: string[]) => driveApi.bulkMoveToTrash(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
      queryClient.invalidateQueries({ queryKey: ['drive-folders'] });
      toast.success('Selected items moved to trash');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to move items to trash');
    },
  });

  const bulkPermanentDeleteItems = useMutation({
    mutationFn: (ids: string[]) => driveApi.bulkPermanentDelete(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
      queryClient.invalidateQueries({ queryKey: ['drive-folders'] });
      toast.success('Selected items permanently deleted');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete items');
    },
  });

  return {
    files: filesQuery.data || [],
    isLoading: filesQuery.isLoading,
    error: filesQuery.error,
    uploadFile,
    deleteFile,
    restoreFile,
    permanentDeleteFile,
    bulkRestoreItems,
    bulkMoveToTrashItems,
    bulkPermanentDeleteItems,
    refetch: filesQuery.refetch,
  };
}

// Hook for activities
export function useDriveActivities() {
  return useQuery({
    queryKey: ['drive-activities'],
    queryFn: () => driveApi.getActivities(),
  });
}

// Hook for search
export function useDriveSearch(query: string) {
  return useQuery({
    queryKey: ['drive-search', query],
    queryFn: () => driveApi.search(query),
    enabled: query.length >= 2,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

// Helper functions
export function formatFileSize(bytes: number | string | undefined): string {
  if (bytes === undefined || bytes === null || bytes === 'NaN' || isNaN(Number(bytes))) return '0 B';
  const numBytes = Number(bytes);
  if (numBytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(numBytes) / Math.log(k));
  return parseFloat((numBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getFileTypeFromMime(mimeType: string): string {
  if (!mimeType) return 'file';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('msword') || mimeType.includes('officedocument.wordprocessingml')) return 'docx';
  if (mimeType.includes('ms-excel') || mimeType.includes('officedocument.spreadsheetml')) return 'xlsx';
  if (mimeType.includes('ms-powerpoint') || mimeType.includes('officedocument.presentationml')) return 'pptx';
  if (mimeType.includes('zip') || mimeType.includes('rar')) return 'archive';
  return 'file';
}