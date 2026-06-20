import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageCropDialogProps {
  open: boolean;
  imageUrl: string;
  initialCrop?: CropArea | null;
  onCancel: () => void;
  onApply: (crop: CropArea | null) => void;
}

export function ImageCropDialog({ open, imageUrl, initialCrop, onCancel, onApply }: ImageCropDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Crop Image</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center bg-muted rounded-lg overflow-hidden min-h-48">
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Crop preview"
              className="max-w-full max-h-64 object-contain"
            />
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="ghost" onClick={() => onApply(null)}>Remove Crop</Button>
          <Button onClick={() => onApply(initialCrop ?? null)}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
