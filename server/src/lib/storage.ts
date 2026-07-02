// File storage adapter.
//
// VeriBhoomi stores document scans (PDF/image) for each plot. This adapter is
// provider-agnostic: it talks the S3 API, which is spoken by Cloudflare R2,
// Supabase Storage, Backblaze B2 and AWS S3 alike — so we are NOT locked in.
//
// If the four S3_* env vars are present, files go to that bucket. If they are
// absent, we fall back to local disk (server/uploads/) so the whole feature is
// testable today with zero cloud account — exactly the pattern we used for the
// database. Set the env vars later and it switches over with no code change.
//
// To go cloud, add to server/.env:
//   S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
//   S3_BUCKET=veribhoomi-docs
//   S3_ACCESS_KEY=...
//   S3_SECRET_KEY=...
//   S3_REGION=auto            (optional; R2 uses "auto")

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const {
  S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION,
} = process.env;

// Cloud mode is on only when all the essentials are configured.
export const usingCloud = Boolean(S3_ENDPOINT && S3_BUCKET && S3_ACCESS_KEY && S3_SECRET_KEY);

const LOCAL_DIR = path.resolve(process.cwd(), "uploads");

const s3 = usingCloud
  ? new S3Client({
      endpoint: S3_ENDPOINT,
      region: S3_REGION || "auto",
      credentials: { accessKeyId: S3_ACCESS_KEY!, secretAccessKey: S3_SECRET_KEY! },
      forcePathStyle: true, // R2/Supabase/B2 want path-style addressing
    })
  : null;

// Save bytes under `key`. Returns the key (which we persist on the Document row).
export async function putObject(key: string, body: Buffer, contentType: string): Promise<string> {
  if (s3) {
    await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: body, ContentType: contentType }));
  } else {
    const full = path.join(LOCAL_DIR, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
  }
  return key;
}

// How a client gets the file. In cloud mode we hand back a short-lived signed
// URL (the browser fetches the bytes straight from the bucket). In local mode
// there is no external URL, so the caller streams the bytes itself.
export interface FileAccess {
  mode: "redirect" | "stream";
  url?: string;        // when mode === "redirect"
  body?: Buffer;       // when mode === "stream"
}

export async function getObjectAccess(key: string): Promise<FileAccess> {
  if (s3) {
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
      { expiresIn: 300 }, // 5 minutes — long enough to view, short enough to be safe
    );
    return { mode: "redirect", url };
  }
  const full = path.join(LOCAL_DIR, key);
  const body = await fs.readFile(full);
  return { mode: "stream", body };
}

export async function deleteObject(key: string): Promise<void> {
  if (s3) {
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  } else {
    await fs.rm(path.join(LOCAL_DIR, key), { force: true });
  }
}
