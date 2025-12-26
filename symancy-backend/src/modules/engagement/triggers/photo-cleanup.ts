/**
 * Photo Cleanup Trigger
 *
 * Cron job to delete old photos based on retention policy:
 * - Basic analysis: delete after 7 days
 * - Cassandra analysis: delete after 90 days
 *
 * Schedule: Daily at 3:00 AM MSK (0 3 * * *)
 */
import { getSupabase } from "@/core/database.js";
import { getLogger } from "@/core/logger.js";
import { deletePhoto } from "../../photo-analysis/storage.service.js";

const logger = getLogger().child({ module: "photo-cleanup" });

/**
 * Retention periods in days
 */
const RETENTION_DAYS = {
  basic: 7,
  cassandra: 90,
} as const;

/**
 * Expired photo record
 */
export interface ExpiredPhoto {
  telegram_user_id: number;
  id: string; // analysis_id
  persona: "basic" | "cassandra";
  created_at: Date;
}

/**
 * Find expired photos based on retention policy
 *
 * @returns Array of expired photo records
 */
export async function findExpiredPhotos(): Promise<ExpiredPhoto[]> {
  const supabase = getSupabase();

  try {
    // Calculate cutoff dates
    const basicCutoff = new Date();
    basicCutoff.setDate(basicCutoff.getDate() - RETENTION_DAYS.basic);

    const cassandraCutoff = new Date();
    cassandraCutoff.setDate(cassandraCutoff.getDate() - RETENTION_DAYS.cassandra);

    logger.debug(
      {
        basicCutoff: basicCutoff.toISOString(),
        cassandraCutoff: cassandraCutoff.toISOString(),
      },
      "Finding expired photos"
    );

    // Query analysis_history for expired records
    // Basic: created_at < basicCutoff AND persona = 'arina'
    // Cassandra: created_at < cassandraCutoff AND persona = 'cassandra'
    const { data: basicExpired, error: basicError } = await supabase
      .from("analysis_history")
      .select("telegram_user_id, id, persona, created_at")
      .eq("persona", "arina")
      .lt("created_at", basicCutoff.toISOString())
      .eq("status", "completed");

    if (basicError) {
      logger.error({ error: basicError }, "Failed to query basic expired photos");
      throw basicError;
    }

    const { data: cassandraExpired, error: cassandraError } = await supabase
      .from("analysis_history")
      .select("telegram_user_id, id, persona, created_at")
      .eq("persona", "cassandra")
      .lt("created_at", cassandraCutoff.toISOString())
      .eq("status", "completed");

    if (cassandraError) {
      logger.error({ error: cassandraError }, "Failed to query cassandra expired photos");
      throw cassandraError;
    }

    const expired = [
      ...(basicExpired || []),
      ...(cassandraExpired || []),
    ] as ExpiredPhoto[];

    logger.info(
      {
        basicCount: basicExpired?.length || 0,
        cassandraCount: cassandraExpired?.length || 0,
        totalCount: expired.length,
      },
      "Found expired photos"
    );

    return expired;
  } catch (error) {
    logger.error({ error }, "Failed to find expired photos");
    throw error;
  }
}

/**
 * Cleanup expired photos
 *
 * Deletes photos from disk for analysis records older than retention period.
 *
 * @returns Number of photos deleted
 */
export async function cleanupExpiredPhotos(): Promise<number> {
  logger.info("Starting photo cleanup");

  try {
    const expired = await findExpiredPhotos();

    if (expired.length === 0) {
      logger.info("No expired photos to clean up");
      return 0;
    }

    let deleted = 0;
    let failed = 0;

    for (const photo of expired) {
      try {
        await deletePhoto(photo.telegram_user_id, photo.id);
        deleted++;

        logger.debug(
          {
            userId: photo.telegram_user_id,
            analysisId: photo.id,
            persona: photo.persona,
            age: Math.floor(
              (Date.now() - new Date(photo.created_at).getTime()) / (1000 * 60 * 60 * 24)
            ),
          },
          "Photo deleted"
        );
      } catch (error) {
        failed++;
        logger.warn(
          {
            error,
            userId: photo.telegram_user_id,
            analysisId: photo.id,
          },
          "Failed to delete photo"
        );
      }
    }

    logger.info(
      { total: expired.length, deleted, failed },
      "Photo cleanup completed"
    );

    return deleted;
  } catch (error) {
    logger.error({ error }, "Photo cleanup failed");
    throw error;
  }
}
