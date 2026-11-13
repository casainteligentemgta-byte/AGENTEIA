import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isPrivateStorageBucket,
  type PrivateStorageBucket,
} from "@/lib/storage/buckets";

/** TTL corto para URLs firmadas de Storage. */
export const SIGNED_URL_TTL_SECONDS = 60 * 15;

const PUBLIC_OBJECT_RE = /\/storage\/v1\/object\/public\/([^/?#]+)\/(.+?)(?:\?|$)/;
const SIGNED_OBJECT_RE = /\/storage\/v1\/object\/sign\/([^/?#]+)\/(.+?)(?:\?|$)/;

export function isSafeStoragePath(path: string): boolean {
  const trimmed = path.trim();
  if (!trimmed || trimmed.length > 1024) return false;
  if (trimmed.startsWith("/") || trimmed.includes("\\") || trimmed.includes("\0")) {
    return false;
  }
  if (trimmed.split("/").some((segment) => segment === ".." || segment === "")) {
    return false;
  }
  return true;
}

export function extractStoragePathFromUrl(
  url: string,
  expectedBucket?: string
): { bucket: string; path: string } | null {
  const publicMatch = url.match(PUBLIC_OBJECT_RE);
  const signedMatch = publicMatch ? null : url.match(SIGNED_OBJECT_RE);
  const match = publicMatch ?? signedMatch;
  if (!match) return null;
  const bucket = decodeURIComponent(match[1] ?? "");
  const path = decodeURIComponent(match[2] ?? "");
  if (!bucket || !isSafeStoragePath(path)) return null;
  if (expectedBucket && bucket !== expectedBucket) return null;
  return { bucket, path };
}

export function isPublicSupabaseStorageUrl(url: string): boolean {
  return PUBLIC_OBJECT_RE.test(url) || SIGNED_OBJECT_RE.test(url);
}

/** Ruta estable de la app; el API autoriza y redirige a un signed URL corto. */
export function toAuthorizedFileUrl(bucket: PrivateStorageBucket, path: string): string {
  const params = new URLSearchParams({ bucket, path });
  return `/api/storage/file?${params.toString()}`;
}

export function rewriteStorageUrlForClient(
  url: string | null | undefined,
  path: string | null | undefined,
  bucket: PrivateStorageBucket
): string | undefined {
  const safePath =
    path && isSafeStoragePath(path)
      ? path
      : url
        ? extractStoragePathFromUrl(url, bucket)?.path
        : undefined;
  if (safePath) {
    return toAuthorizedFileUrl(bucket, safePath);
  }
  if (url && url.trim()) return url;
  return undefined;
}

export async function createSignedStorageUrl(
  supabase: SupabaseClient,
  bucket: PrivateStorageBucket,
  path: string,
  expiresIn = SIGNED_URL_TTL_SECONDS
): Promise<string | null> {
  if (!isPrivateStorageBucket(bucket) || !isSafeStoragePath(path)) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
