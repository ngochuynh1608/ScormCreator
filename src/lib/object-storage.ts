import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { projectDir } from "./storage";

function s3Configured() {
  return Boolean(
    process.env.S3_ENDPOINT?.trim() &&
      process.env.S3_BUCKET?.trim() &&
      process.env.S3_ACCESS_KEY?.trim() &&
      process.env.S3_SECRET_KEY?.trim(),
  );
}

export function isObjectStorageConfigured() {
  return s3Configured();
}

let client: S3Client | null = null;
let bucketReady: Promise<void> | null = null;

function getClient() {
  if (!s3Configured()) {
    throw new Error("Object storage (S3/MinIO) chưa được cấu hình.");
  }
  if (!client) {
    client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || "us-east-1",
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
      },
    });
  }
  return client;
}

function bucket() {
  return process.env.S3_BUCKET!;
}

export function objectKey(projectId: string, relativePath: string) {
  const rel = relativePath.split(path.sep).join("/");
  return `projects/${projectId}/${rel.replace(/^\/+/, "")}`;
}

async function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const c = getClient();
      try {
        await c.send(new HeadBucketCommand({ Bucket: bucket() }));
      } catch {
        await c.send(new CreateBucketCommand({ Bucket: bucket() })).catch(() => undefined);
      }
    })();
  }
  await bucketReady;
}

export async function putObject(
  projectId: string,
  relativePath: string,
  body: Buffer | Uint8Array | string,
  contentType?: string,
) {
  if (!s3Configured()) return;
  await ensureBucket();
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: objectKey(projectId, relativePath),
      Body: typeof body === "string" ? Buffer.from(body) : body,
      ContentType: contentType,
    }),
  );
}

export async function putObjectFile(
  projectId: string,
  relativePath: string,
  absolutePath: string,
  contentType?: string,
) {
  if (!s3Configured()) return;
  const data = await fs.readFile(absolutePath);
  await putObject(projectId, relativePath, data, contentType);
}

export async function getObjectBuffer(
  projectId: string,
  relativePath: string,
): Promise<Buffer | null> {
  if (!s3Configured()) return null;
  try {
    await ensureBucket();
    const res = await getClient().send(
      new GetObjectCommand({
        Bucket: bucket(),
        Key: objectKey(projectId, relativePath),
      }),
    );
    if (!res.Body) return null;
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch {
    return null;
  }
}

export async function deleteObject(projectId: string, relativePath: string) {
  if (!s3Configured()) return;
  try {
    await getClient().send(
      new DeleteObjectCommand({
        Bucket: bucket(),
        Key: objectKey(projectId, relativePath),
      }),
    );
  } catch {
    // ignore
  }
}

/** Ensure a project-relative file exists locally (download from S3 if needed). */
export async function ensureLocalProjectFile(
  projectId: string,
  relativePath: string,
): Promise<string> {
  const abs = path.join(projectDir(projectId), relativePath);
  try {
    await fs.access(abs);
    return abs;
  } catch {
    // fall through
  }

  const remote = await getObjectBuffer(projectId, relativePath);
  if (!remote) {
    throw new Error(`Không tìm thấy file ${relativePath} (local/S3).`);
  }
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, remote);
  return abs;
}

export async function syncProjectDirToObjectStorage(projectId: string) {
  if (!s3Configured()) return;
  const root = projectDir(projectId);
  if (!existsSync(root)) return;

  async function walk(dir: string, prefix: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name.startsWith("_")) continue;
        await walk(abs, rel);
      } else if (entry.isFile()) {
        if (entry.name.endsWith(".tmp")) continue;
        await putObjectFile(projectId, rel, abs);
      }
    }
  }

  await walk(root, "");
}

export async function createSignedGetUrl(
  projectId: string,
  relativePath: string,
  expiresIn = 3600,
) {
  if (!s3Configured()) return null;
  await ensureBucket();
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: objectKey(projectId, relativePath),
    }),
    { expiresIn },
  );
}

export async function listProjectObjectKeys(projectId: string) {
  if (!s3Configured()) return [];
  await ensureBucket();
  const prefix = `projects/${projectId}/`;
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const res = await getClient().send(
      new ListObjectsV2Command({
        Bucket: bucket(),
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const obj of res.Contents || []) {
      if (obj.Key) keys.push(obj.Key);
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

export async function deleteProjectObjects(projectId: string) {
  if (!s3Configured()) return;
  const keys = await listProjectObjectKeys(projectId);
  await Promise.all(
    keys.map((key) => {
      const rel = key.replace(`projects/${projectId}/`, "");
      return deleteObject(projectId, rel);
    }),
  );
}
