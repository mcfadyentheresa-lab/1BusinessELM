import { useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Upload, Trash2, ImageOff } from "lucide-react";
import {
  usePhotos,
  useCreatePhoto,
  useUploadImage,
  useDeletePhoto,
} from "@/hooks/use-projects";
import type { Photo } from "@/shared/database.types";

interface PhotosDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  onDrop?: (photo: Photo) => void;
}

export function PhotosDrawer({ open, onOpenChange, projectId, onDrop }: PhotosDrawerProps) {
  const { data: photos, isLoading } = usePhotos(projectId);
  const createPhoto = useCreatePhoto();
  const uploadImage = useUploadImage();
  const deletePhoto = useDeletePhoto();
  const fileRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<Photo | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const handleUpload = async (files: FileList) => {
    for (const file of Array.from(files)) {
      const result = await uploadImage.mutateAsync(file);
      await createPhoto.mutateAsync({ projectId, url: result.url, caption: file.name.replace(/\.[^.]+$/, "") });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deletePhoto.mutateAsync({ id: deleteTarget.id, projectId });
    setDeleteTarget(null);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-80 sm:w-96 flex flex-col gap-0 p-0">
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base">Photos</SheetTitle>
              <Button
                size="sm"
                variant="secondary"
                className="h-8 gap-1.5"
                onClick={() => fileRef.current?.click()}
                disabled={uploadImage.isPending || createPhoto.isPending}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload
              </Button>
            </div>
          </SheetHeader>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
          />

          <div className="flex-1 overflow-y-auto p-3">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
              </div>
            ) : !photos?.length ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                <ImageOff className="h-10 w-10 text-muted-foreground/30" />
                <div>
                  <p className="text-sm font-medium text-foreground">No photos yet</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Upload photos to use on your board.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className={`group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted cursor-grab active:cursor-grabbing transition-opacity ${
                      draggingId === photo.id ? "opacity-50" : ""
                    }`}
                    draggable
                    onDragStart={(e) => {
                      setDraggingId(photo.id);
                      e.dataTransfer.setData("application/json", JSON.stringify({ type: "photo", photo }));
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    onDoubleClick={() => onDrop?.(photo)}
                    title="Drag onto board or double-click to add"
                  >
                    <img
                      src={photo.url}
                      alt={photo.caption ?? ""}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {photo.caption && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5 translate-y-full group-hover:translate-y-0 transition-transform">
                        <p className="text-[10px] text-white truncate">{photo.caption}</p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(photo)}
                      className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                      aria-label="Delete photo"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete photo?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this photo from the project. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
