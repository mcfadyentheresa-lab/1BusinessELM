import { useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface UploadResult {
  objectPath: string;
}

export function useUpload() {
  const uploadFile = useCallback(async (file: File): Promise<UploadResult | null> => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `uploads/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from("project-assets")
      .upload(path, file, { upsert: false });
    if (error) return null;
    const { data } = supabase.storage.from("project-assets").getPublicUrl(path);
    return { objectPath: data.publicUrl };
  }, []);

  return { uploadFile };
}
