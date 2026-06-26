import { supabase } from "@/integrations/supabase/client";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export async function uploadMedia(file: File, userId: string, folder = "media"): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data, error: sErr } = await supabase.storage.from("media").createSignedUrl(path, TEN_YEARS);
  if (sErr || !data?.signedUrl) throw sErr ?? new Error("Failed to sign URL");
  return data.signedUrl;
}
