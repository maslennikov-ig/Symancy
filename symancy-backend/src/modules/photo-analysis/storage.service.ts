/**
 * Photo Storage Service
 *
 * Save analyzed photos to disk for future reference and debugging.
 * Photos are stored by user ID and analysis ID in WebP format.
 *
 * Storage structure:
 * /var/data/symancy/photos/{userId}/{analysisId}.webp
 * or ./data/photos/{userId}/{analysisId}.webp (development)
 *
 * Retention policy:
 * - Basic analysis: 7 days
 * - Cassandra analysis: 90 days
 */
import fs from "node:fs/promises";
import path from "node:path";
import { getLogger } from "@/core/logger.js";
import { getEnv } from "@/config/env.js";

const logger = getLogger().child({ module: "photo-storage" });

/**
 * Photo storage options
 */
export interface PhotoStorageOptions {
  /** Telegram user ID */
  userId: number;
  /** Analysis record ID (UUID) */
  analysisId: string;
  /** Analysis type for retention policy */
  analysisType: "basic" | "cassandra";
}

/**
 * Get base storage path from environment or use default
 * Ensures directory exists
 */
async function getStoragePath(): Promise<string> {
  const env = getEnv();
  const basePath = env.PHOTO_STORAGE_PATH || "./data/photos";

  // Create base directory if it doesn't exist
  try {
    await fs.mkdir(basePath, { recursive: true });
  } catch (error) {
    logger.error({ error, basePath }, "Failed to create storage directory");
    throw new Error(`Failed to create storage directory: ${basePath}`);
  }

  return basePath;
}

/**
 * Get full file path for a photo
 *
 * @param userId - Telegram user ID
 * @param analysisId - Analysis record ID
 * @returns Full file path: {basePath}/{userId}/{analysisId}.webp
 */
async function getFilePath(userId: number, analysisId: string): Promise<string> {
  const basePath = await getStoragePath();
  const userDir = path.join(basePath, String(userId));

  // Create user directory if it doesn't exist
  try {
    await fs.mkdir(userDir, { recursive: true });
  } catch (error) {
    logger.error({ error, userId, userDir }, "Failed to create user directory");
    throw new Error(`Failed to create user directory: ${userDir}`);
  }

  return path.join(userDir, `${analysisId}.webp`);
}

/**
 * Save photo to disk
 *
 * @param buffer - Image buffer (WebP format)
 * @param options - Storage options (userId, analysisId, analysisType)
 * @returns File path where photo was saved
 *
 * @example
 * ```typescript
 * const filePath = await savePhoto(imageBuffer, {
 *   userId: 123456,
 *   analysisId: "uuid-here",
 *   analysisType: "basic",
 * });
 * ```
 */
export async function savePhoto(
  buffer: Buffer,
  options: PhotoStorageOptions
): Promise<string> {
  const { userId, analysisId } = options;

  try {
    const filePath = await getFilePath(userId, analysisId);

    // Write buffer to file
    await fs.writeFile(filePath, buffer);

    logger.info(
      { userId, analysisId, filePath, size: buffer.length },
      "Photo saved to disk"
    );

    return filePath;
  } catch (error) {
    logger.error(
      { error, userId, analysisId },
      "Failed to save photo to disk"
    );
    throw error;
  }
}

/**
 * Get photo from disk
 *
 * @param userId - Telegram user ID
 * @param analysisId - Analysis record ID
 * @returns Image buffer or null if not found
 *
 * @example
 * ```typescript
 * const buffer = await getPhoto(123456, "uuid-here");
 * if (buffer) {
 *   // Use buffer
 * }
 * ```
 */
export async function getPhoto(
  userId: number,
  analysisId: string
): Promise<Buffer | null> {
  try {
    const filePath = await getFilePath(userId, analysisId);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      logger.debug({ userId, analysisId, filePath }, "Photo not found");
      return null;
    }

    // Read file
    const buffer = await fs.readFile(filePath);

    logger.debug(
      { userId, analysisId, filePath, size: buffer.length },
      "Photo loaded from disk"
    );

    return buffer;
  } catch (error) {
    logger.error(
      { error, userId, analysisId },
      "Failed to load photo from disk"
    );
    return null;
  }
}

/**
 * Delete photo from disk
 *
 * @param userId - Telegram user ID
 * @param analysisId - Analysis record ID
 *
 * @example
 * ```typescript
 * await deletePhoto(123456, "uuid-here");
 * ```
 */
export async function deletePhoto(
  userId: number,
  analysisId: string
): Promise<void> {
  try {
    const filePath = await getFilePath(userId, analysisId);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      logger.debug({ userId, analysisId, filePath }, "Photo already deleted");
      return;
    }

    // Delete file
    await fs.unlink(filePath);

    logger.info({ userId, analysisId, filePath }, "Photo deleted from disk");
  } catch (error) {
    logger.error(
      { error, userId, analysisId },
      "Failed to delete photo from disk"
    );
    throw error;
  }
}

/**
 * Delete all photos for a user
 * Useful for user data deletion (GDPR)
 *
 * @param userId - Telegram user ID
 * @returns Number of photos deleted
 */
export async function deleteUserPhotos(userId: number): Promise<number> {
  try {
    const basePath = await getStoragePath();
    const userDir = path.join(basePath, String(userId));

    // Check if user directory exists
    try {
      await fs.access(userDir);
    } catch {
      logger.debug({ userId, userDir }, "User directory does not exist");
      return 0;
    }

    // Read all files in user directory
    const files = await fs.readdir(userDir);
    let deleted = 0;

    for (const file of files) {
      if (file.endsWith(".webp")) {
        const filePath = path.join(userDir, file);
        await fs.unlink(filePath);
        deleted++;
      }
    }

    // Remove empty directory
    try {
      await fs.rmdir(userDir);
    } catch {
      // Directory not empty or already deleted
    }

    logger.info({ userId, deleted }, "Deleted all user photos");
    return deleted;
  } catch (error) {
    logger.error({ error, userId }, "Failed to delete user photos");
    throw error;
  }
}

/**
 * Get storage statistics
 *
 * @returns Stats object with total photos and total size
 */
export async function getStorageStats(): Promise<{
  totalPhotos: number;
  totalSizeBytes: number;
  totalUsers: number;
}> {
  try {
    const basePath = await getStoragePath();

    let totalPhotos = 0;
    let totalSizeBytes = 0;
    let totalUsers = 0;

    // Read all user directories
    const userDirs = await fs.readdir(basePath);

    for (const userDir of userDirs) {
      const userPath = path.join(basePath, userDir);

      // Check if it's a directory
      const stat = await fs.stat(userPath);
      if (!stat.isDirectory()) {
        continue;
      }

      totalUsers++;

      // Read all files in user directory
      const files = await fs.readdir(userPath);
      for (const file of files) {
        if (file.endsWith(".webp")) {
          const filePath = path.join(userPath, file);
          const fileStat = await fs.stat(filePath);
          totalPhotos++;
          totalSizeBytes += fileStat.size;
        }
      }
    }

    logger.info(
      { totalPhotos, totalSizeBytes, totalUsers },
      "Storage stats calculated"
    );

    return { totalPhotos, totalSizeBytes, totalUsers };
  } catch (error) {
    logger.error({ error }, "Failed to calculate storage stats");
    throw error;
  }
}
