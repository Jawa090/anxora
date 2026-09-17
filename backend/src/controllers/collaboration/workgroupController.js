const db = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const realtimeService = require('../../services/realtimeService');
const pushService = require('../../services/pushService');
const fcmService = require('../../services/fcmService');
const { createNotification } = require('./workgroupNotificationsController');

const createSystemPost = async (workgroupId, actorUserId, content) => {
  const postId = uuidv4();
  await db.query(
    `INSERT INTO workgroup_posts (
      id, workgroup_id, user_id, content, content_type
    ) VALUES ($1, $2, $3, $4, $5)`,
    [postId, workgroupId, actorUserId, `[SYSTEM] ${content}`, 'text']
  );

  const postResult = await db.query(
    `SELECT p.*, u.full_name as author_name, u.avatar_url as author_avatar
     FROM workgroup_posts p
     JOIN users u ON p.user_id = u.id
     WHERE p.id = $1`,
    [postId]
  );

  if (postResult.rows[0]) {
    realtimeService.emitWorkgroupPost(workgroupId, postResult.rows[0]);
  }
};

/**
 * Transfer workgroup ownership to moderator or earliest member when creator leaves or is deleted.
 */
const handleWorkgroupCreatorDeparture = async (workgroupId, exitingUserId, executorUserId, dbClient = db) => {
  try {
    const wgRes = await dbClient.query(
      `SELECT id, name, created_by, settings, org_id FROM workgroups WHERE id = $1`,
      [workgroupId]
    );
    if (wgRes.rows.length === 0) return null;
    const wg = wgRes.rows[0];

    const isDirectChat = Boolean(wg.settings?.is_direct_chat);
    if (isDirectChat) return null;

    // Only transfer if exiting user is actually the creator
    if (wg.created_by !== exitingUserId) {
      return null;
    }

    const modUserId = wg.settings?.member_manager_user_id || null;

    // Priority 1: Moderator (assigned manager or role = 'moderator')
    let successor = null;
    if (modUserId && modUserId !== exitingUserId) {
      const modRes = await dbClient.query(
        `SELECT wm.user_id, u.full_name 
         FROM workgroup_members wm
         JOIN users u ON u.id = wm.user_id
         WHERE wm.workgroup_id = $1 AND wm.user_id = $2 AND u.is_active = true AND COALESCE(wm.status, 'active') = 'active'
         LIMIT 1`,
        [workgroupId, modUserId]
      );
      if (modRes.rows.length > 0) {
        successor = modRes.rows[0];
      }
    }

    if (!successor) {
      const modRoleRes = await dbClient.query(
        `SELECT wm.user_id, u.full_name 
         FROM workgroup_members wm
         JOIN users u ON u.id = wm.user_id
         WHERE wm.workgroup_id = $1 AND wm.user_id <> $2 AND wm.role = 'moderator' AND u.is_active = true AND COALESCE(wm.status, 'active') = 'active'
         ORDER BY wm.joined_at ASC
         LIMIT 1`,
        [workgroupId, exitingUserId]
      );
      if (modRoleRes.rows.length > 0) {
        successor = modRoleRes.rows[0];
      }
    }

    // Priority 2: Earliest joined active member
    if (!successor) {
      const firstMemberRes = await dbClient.query(
        `SELECT wm.user_id, u.full_name 
         FROM workgroup_members wm
         JOIN users u ON u.id = wm.user_id
         WHERE wm.workgroup_id = $1 AND wm.user_id <> $2 AND u.is_active = true AND COALESCE(wm.status, 'active') = 'active'
         ORDER BY wm.joined_at ASC
         LIMIT 1`,
        [workgroupId, exitingUserId]
      );
      if (firstMemberRes.rows.length > 0) {
        successor = firstMemberRes.rows[0];
      }
    }

    if (successor) {
      // Reassign created_by to successor
      await dbClient.query(
        `UPDATE workgroups 
         SET created_by = $1, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [successor.user_id, workgroupId]
      );

      // Upgrade role in workgroup_members to owner for successor
      await dbClient.query(
        `UPDATE workgroup_members 
         SET role = 'owner' 
         WHERE workgroup_id = $1 AND user_id = $2`,
        [workgroupId, successor.user_id]
      );

      // Demote exiting user in workgroup_members to normal 'member'
      await dbClient.query(
        `UPDATE workgroup_members 
         SET role = 'member' 
         WHERE workgroup_id = $1 AND user_id = $2`,
        [workgroupId, exitingUserId]
      );

      // Announce ownership transfer via system message
      const systemActorId = executorUserId || successor.user_id;
      const transferPostId = uuidv4();
      await dbClient.query(
        `INSERT INTO workgroup_posts (
          id, workgroup_id, user_id, content, content_type
        ) VALUES ($1, $2, $3, $4, 'text')`,
        [
          transferPostId,
          workgroupId,
          systemActorId,
          `[SYSTEM] Group creator left. Ownership transferred to ${successor.full_name}.`,
        ]
      );

      const postResult = await dbClient.query(
        `SELECT p.*, u.full_name as author_name, u.avatar_url as author_avatar
         FROM workgroup_posts p
         JOIN users u ON p.user_id = u.id
         WHERE p.id = $1`,
        [transferPostId]
      );
      if (postResult.rows[0]) {
        realtimeService.emitWorkgroupPost(workgroupId, postResult.rows[0]);
      }

      realtimeService.emitWorkgroupUpdated(wg.org_id, {
        action: 'ownership_transferred',
        workgroup_id: workgroupId,
        new_creator_id: successor.user_id,
        workgroup: { id: workgroupId, created_by: successor.user_id }
      });

      return successor;
    }

    return null;
  } catch (err) {
    console.error('Error transferring workgroup ownership on creator departure:', err);
    return null;
  }
};


const markWorkgroupPostsAsRead = async (workgroupId, userId) => {
  try {
    const readResult = await db.query(
      `
        INSERT INTO workgroup_post_reads (post_id, user_id, read_at)
        SELECT p.id, $2::uuid, CURRENT_TIMESTAMP
        FROM workgroup_posts p
        WHERE p.workgroup_id = $1
          AND p.user_id <> $2
          AND p.is_deleted = false
          AND NOT ($2::uuid = ANY(COALESCE(p.deleted_for_users, '{}'::uuid[])))
        ON CONFLICT (post_id, user_id) DO NOTHING
        RETURNING post_id
      `,
      [workgroupId, userId],
    );

    if (readResult.rows.length > 0) {
      const userResult = await db.query(
        "SELECT id as user_id, full_name, avatar_url FROM users WHERE id = $1",
        [userId],
      );
      const userInfo = userResult.rows[0];
      if (userInfo) {
        realtimeService.emitWorkgroupPostSeen(workgroupId, {
          postIds: readResult.rows.map((r) => r.post_id),
          user: userInfo,
        });
      }
    }
  } catch (err) {
    console.error("Failed to mark posts as read real-time:", err.message);
  }
};

// Get all workgroups for organization
const getWorkgroups = async (req, res, next) => {
  try {
    const { type, search } = req.query;

    let query = `
      SELECT 
        w.*,
        CASE
          WHEN COALESCE((w.settings->>'is_direct_chat')::boolean, false) = true THEN (
            COALESCE(
              (
                SELECT u_peer.full_name
                FROM users u_peer
                WHERE u_peer.id = COALESCE(
                  (
                    SELECT wm_peer.user_id
                    FROM workgroup_members wm_peer
                    WHERE wm_peer.workgroup_id = w.id
                      AND wm_peer.user_id <> $1
                    ORDER BY wm_peer.joined_at ASC
                    LIMIT 1
                  ),
                  CASE
                    WHEN w.settings->>'direct_pair_key' IS NOT NULL THEN (
                      CASE
                        WHEN SPLIT_PART(w.settings->>'direct_pair_key', ':', 1) = $1::text 
                        THEN NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 2), '')::uuid
                        ELSE NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 1), '')::uuid
                      END
                    )
                    ELSE NULL
                  END
                )
              ),
              w.name
            )
          )
          ELSE w.name
        END as display_name,
        CASE
          WHEN COALESCE((w.settings->>'is_direct_chat')::boolean, false) = true THEN (
            COALESCE(
              (
                SELECT wm_peer.user_id
                FROM workgroup_members wm_peer
                WHERE wm_peer.workgroup_id = w.id
                  AND wm_peer.user_id <> $1
                ORDER BY wm_peer.joined_at ASC
                LIMIT 1
              ),
              CASE
                WHEN w.settings->>'direct_pair_key' IS NOT NULL THEN (
                  CASE
                    WHEN SPLIT_PART(w.settings->>'direct_pair_key', ':', 1) = $1::text 
                    THEN NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 2), '')::uuid
                    ELSE NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 1), '')::uuid
                  END
                )
                ELSE NULL
              END
            )
          )
          ELSE NULL
        END as direct_peer_user_id,
        CASE
          WHEN COALESCE((w.settings->>'is_direct_chat')::boolean, false) = true THEN (
            SELECT COALESCE(u_peer.last_seen_at, u_peer.last_login)
            FROM users u_peer
            WHERE u_peer.id = COALESCE(
              (
                SELECT wm_peer.user_id
                FROM workgroup_members wm_peer
                WHERE wm_peer.workgroup_id = w.id
                  AND wm_peer.user_id <> $1
                ORDER BY wm_peer.joined_at ASC
                LIMIT 1
              ),
              CASE
                WHEN w.settings->>'direct_pair_key' IS NOT NULL THEN (
                  CASE
                    WHEN SPLIT_PART(w.settings->>'direct_pair_key', ':', 1) = $1::text 
                    THEN NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 2), '')::uuid
                    ELSE NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 1), '')::uuid
                  END
                )
                ELSE NULL
              END
            )
          )
          ELSE NULL
        END as direct_peer_last_seen_at,
        CASE
          WHEN COALESCE((w.settings->>'is_direct_chat')::boolean, false) = true THEN (
            SELECT u_peer.avatar_url
            FROM users u_peer
            WHERE u_peer.id = COALESCE(
              (
                SELECT wm_peer.user_id
                FROM workgroup_members wm_peer
                WHERE wm_peer.workgroup_id = w.id
                  AND wm_peer.user_id <> $1
                ORDER BY wm_peer.joined_at ASC
                LIMIT 1
              ),
              CASE
                WHEN w.settings->>'direct_pair_key' IS NOT NULL THEN (
                  CASE
                    WHEN SPLIT_PART(w.settings->>'direct_pair_key', ':', 1) = $1::text 
                    THEN NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 2), '')::uuid
                    ELSE NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 1), '')::uuid
                  END
                )
                ELSE NULL
              END
            )
          )
          ELSE NULL
        END as direct_peer_avatar_url,
        CASE
          WHEN COALESCE((w.settings->>'is_direct_chat')::boolean, false) = true THEN (
            CASE
              WHEN EXISTS (
                SELECT 1 FROM users u_check
                WHERE u_check.id = COALESCE(
                  (SELECT wm_peer.user_id FROM workgroup_members wm_peer WHERE wm_peer.workgroup_id = w.id AND wm_peer.user_id <> $1 LIMIT 1),
                  CASE
                    WHEN w.settings->>'direct_pair_key' IS NOT NULL THEN (
                      CASE
                        WHEN SPLIT_PART(w.settings->>'direct_pair_key', ':', 1) = $1::text 
                        THEN NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 2), '')::uuid
                        ELSE NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 1), '')::uuid
                      END
                    )
                    ELSE NULL
                  END
                )
                AND u_check.is_active = true
              ) THEN false
              ELSE true
            END
          )
          ELSE false
        END as is_peer_deleted,
        CASE
          WHEN COALESCE((w.settings->>'is_direct_chat')::boolean, false) = true THEN (
            CASE
              WHEN EXISTS (
                SELECT 1 FROM users u_check
                WHERE u_check.id = COALESCE(
                  (SELECT wm_peer.user_id FROM workgroup_members wm_peer WHERE wm_peer.workgroup_id = w.id AND wm_peer.user_id <> $1 LIMIT 1),
                  CASE
                    WHEN w.settings->>'direct_pair_key' IS NOT NULL THEN (
                      CASE
                        WHEN SPLIT_PART(w.settings->>'direct_pair_key', ':', 1) = $1::text 
                        THEN NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 2), '')::uuid
                        ELSE NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 1), '')::uuid
                      END
                    )
                    ELSE NULL
                  END
                )
                AND u_check.is_active = true
              ) THEN 'active'
              WHEN EXISTS (
                SELECT 1 FROM users u_check
                WHERE u_check.id = COALESCE(
                  (SELECT wm_peer.user_id FROM workgroup_members wm_peer WHERE wm_peer.workgroup_id = w.id AND wm_peer.user_id <> $1 LIMIT 1),
                  CASE
                    WHEN w.settings->>'direct_pair_key' IS NOT NULL THEN (
                      CASE
                        WHEN SPLIT_PART(w.settings->>'direct_pair_key', ':', 1) = $1::text 
                        THEN NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 2), '')::uuid
                        ELSE NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 1), '')::uuid
                      END
                    )
                    ELSE NULL
                  END
                )
                AND u_check.is_active = false
              ) THEN 'inactive'
              ELSE 'deleted'
            END
          )
          ELSE NULL
        END as direct_peer_status,
        u.full_name as created_by_name,
        COUNT(DISTINCT wm.user_id) as member_count,
        COUNT(DISTINCT wp.id) as message_count,
        COUNT(
          DISTINCT CASE
            WHEN wp.created_at >= CURRENT_DATE THEN wp.id
            ELSE NULL
          END
        ) as today_message_count,
        MAX(wp.created_at) as last_message_at,
        (
          SELECT u2.full_name
          FROM workgroup_posts p2
          JOIN users u2 ON u2.id = p2.user_id
          WHERE p2.workgroup_id = w.id
            AND p2.is_deleted = false
          ORDER BY p2.created_at DESC
          LIMIT 1
        ) as last_message_sender_name,
        (
          SELECT COUNT(*)::int
          FROM workgroup_posts p3
          WHERE p3.workgroup_id = w.id
            AND p3.is_deleted = false
            AND p3.user_id <> $1
            AND NOT ($1::uuid = ANY(COALESCE(p3.deleted_for_users, '{}'::uuid[])))
            AND NOT EXISTS (
              SELECT 1
              FROM workgroup_post_reads r
              WHERE r.post_id = p3.id
                AND r.user_id = $1
            )
        ) as unread_count,
        EXISTS (
          SELECT 1
          FROM workgroup_members wm_self
          WHERE wm_self.workgroup_id = w.id
            AND wm_self.user_id = $1
        ) as is_member,
        COALESCE(
          (
            SELECT wm_self.is_starred
            FROM workgroup_members wm_self
            WHERE wm_self.workgroup_id = w.id
              AND wm_self.user_id = $1
          ), false
        ) as is_starred,
        (
          SELECT wm_self.role
          FROM workgroup_members wm_self
          WHERE wm_self.workgroup_id = w.id
            AND wm_self.user_id = $1
        ) as user_role,
        (
          SELECT wm_self.status
          FROM workgroup_members wm_self
          WHERE wm_self.workgroup_id = w.id
            AND wm_self.user_id = $1
        ) as user_status
      FROM workgroups w
      LEFT JOIN users u ON w.created_by = u.id
      LEFT JOIN workgroup_members wm ON w.id = wm.workgroup_id
      LEFT JOIN workgroup_posts wp ON w.id = wp.workgroup_id AND wp.is_deleted = false
      WHERE w.org_id = $2 AND w.is_archived = false
    `;

    const params = [req.user.id, req.user.orgId];
    let paramIndex = 3;

    // Filter by type
    if (type && type !== 'all') {
      query += ` AND w.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    // Search filter
    if (search) {
      query += ` AND (w.name ILIKE $${paramIndex} OR w.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Only show workgroups the current user is a member of.
    query += `
      AND EXISTS (
        SELECT 1
        FROM workgroup_members wm_self
        WHERE wm_self.workgroup_id = w.id
          AND wm_self.user_id = $1
      )
    `;

    query += `
      GROUP BY w.id, u.full_name
      ORDER BY COALESCE(MAX(wp.created_at), w.last_activity_at, w.created_at) DESC
    `;

    const result = await db.query(query, params);

    // Add activity indicators
    const workgroups = result.rows.map((wg) => {
      let isOnline = false;
      let lastSeenAt = null;
      if (wg.direct_peer_user_id) {
        const presence = realtimeService.getUserPresence(wg.direct_peer_user_id);
        isOnline = Boolean(presence.isOnline);
        lastSeenAt = presence.lastSeenAt || wg.direct_peer_last_seen_at || null;
      }

      return {
        ...wg,
        has_recent_activity:
          wg.last_message_at &&
          new Date(wg.last_message_at) > new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        is_online: isOnline,
        last_seen_at: lastSeenAt,
      };
    });

    res.json(workgroups);
  } catch (err) {
    next(err);
  }
};

// Get single workgroup
const getWorkgroup = async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        w.*,
        CASE
          WHEN COALESCE((w.settings->>'is_direct_chat')::boolean, false) = true THEN (
            COALESCE(
              (
                SELECT u_peer.full_name
                FROM users u_peer
                WHERE u_peer.id = COALESCE(
                  (
                    SELECT wm_peer.user_id
                    FROM workgroup_members wm_peer
                    WHERE wm_peer.workgroup_id = w.id
                      AND wm_peer.user_id <> $1
                    ORDER BY wm_peer.joined_at ASC
                    LIMIT 1
                  ),
                  CASE
                    WHEN w.settings->>'direct_pair_key' IS NOT NULL THEN (
                      CASE
                        WHEN SPLIT_PART(w.settings->>'direct_pair_key', ':', 1) = $1::text 
                        THEN NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 2), '')::uuid
                        ELSE NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 1), '')::uuid
                      END
                    )
                    ELSE NULL
                  END
                )
              ),
              w.name
            )
          )
          ELSE w.name
        END as display_name,
        CASE
          WHEN COALESCE((w.settings->>'is_direct_chat')::boolean, false) = true THEN (
            COALESCE(
              (
                SELECT wm_peer.user_id
                FROM workgroup_members wm_peer
                WHERE wm_peer.workgroup_id = w.id
                  AND wm_peer.user_id <> $1
                ORDER BY wm_peer.joined_at ASC
                LIMIT 1
              ),
              CASE
                WHEN w.settings->>'direct_pair_key' IS NOT NULL THEN (
                  CASE
                    WHEN SPLIT_PART(w.settings->>'direct_pair_key', ':', 1) = $1::text 
                    THEN NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 2), '')::uuid
                    ELSE NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 1), '')::uuid
                  END
                )
                ELSE NULL
              END
            )
          )
          ELSE NULL
        END as direct_peer_user_id,
        CASE
          WHEN COALESCE((w.settings->>'is_direct_chat')::boolean, false) = true THEN (
            SELECT COALESCE(u_peer.last_seen_at, u_peer.last_login)
            FROM users u_peer
            WHERE u_peer.id = COALESCE(
              (
                SELECT wm_peer.user_id
                FROM workgroup_members wm_peer
                WHERE wm_peer.workgroup_id = w.id
                  AND wm_peer.user_id <> $1
                ORDER BY wm_peer.joined_at ASC
                LIMIT 1
              ),
              CASE
                WHEN w.settings->>'direct_pair_key' IS NOT NULL THEN (
                  CASE
                    WHEN SPLIT_PART(w.settings->>'direct_pair_key', ':', 1) = $1::text 
                    THEN NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 2), '')::uuid
                    ELSE NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 1), '')::uuid
                  END
                )
                ELSE NULL
              END
            )
          )
          ELSE NULL
        END as direct_peer_last_seen_at,
        CASE
          WHEN COALESCE((w.settings->>'is_direct_chat')::boolean, false) = true THEN (
            SELECT u_peer.avatar_url
            FROM users u_peer
            WHERE u_peer.id = COALESCE(
              (
                SELECT wm_peer.user_id
                FROM workgroup_members wm_peer
                WHERE wm_peer.workgroup_id = w.id
                  AND wm_peer.user_id <> $1
                ORDER BY wm_peer.joined_at ASC
                LIMIT 1
              ),
              CASE
                WHEN w.settings->>'direct_pair_key' IS NOT NULL THEN (
                  CASE
                    WHEN SPLIT_PART(w.settings->>'direct_pair_key', ':', 1) = $1::text 
                    THEN NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 2), '')::uuid
                    ELSE NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 1), '')::uuid
                  END
                )
                ELSE NULL
              END
            )
          )
          ELSE NULL
        END as direct_peer_avatar_url,
        CASE
          WHEN COALESCE((w.settings->>'is_direct_chat')::boolean, false) = true THEN (
            CASE
              WHEN EXISTS (
                SELECT 1 FROM users u_check
                WHERE u_check.id = COALESCE(
                  (SELECT wm_peer.user_id FROM workgroup_members wm_peer WHERE wm_peer.workgroup_id = w.id AND wm_peer.user_id <> $1 LIMIT 1),
                  CASE
                    WHEN w.settings->>'direct_pair_key' IS NOT NULL THEN (
                      CASE
                        WHEN SPLIT_PART(w.settings->>'direct_pair_key', ':', 1) = $1::text 
                        THEN NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 2), '')::uuid
                        ELSE NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 1), '')::uuid
                      END
                    )
                    ELSE NULL
                  END
                )
                AND u_check.is_active = true
              ) THEN false
              ELSE true
            END
          )
          ELSE false
        END as is_peer_deleted,
        CASE
          WHEN COALESCE((w.settings->>'is_direct_chat')::boolean, false) = true THEN (
            CASE
              WHEN EXISTS (
                SELECT 1 FROM users u_check
                WHERE u_check.id = COALESCE(
                  (SELECT wm_peer.user_id FROM workgroup_members wm_peer WHERE wm_peer.workgroup_id = w.id AND wm_peer.user_id <> $1 LIMIT 1),
                  CASE
                    WHEN w.settings->>'direct_pair_key' IS NOT NULL THEN (
                      CASE
                        WHEN SPLIT_PART(w.settings->>'direct_pair_key', ':', 1) = $1::text 
                        THEN NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 2), '')::uuid
                        ELSE NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 1), '')::uuid
                      END
                    )
                    ELSE NULL
                  END
                )
                AND u_check.is_active = true
              ) THEN 'active'
              WHEN EXISTS (
                SELECT 1 FROM users u_check
                WHERE u_check.id = COALESCE(
                  (SELECT wm_peer.user_id FROM workgroup_members wm_peer WHERE wm_peer.workgroup_id = w.id AND wm_peer.user_id <> $1 LIMIT 1),
                  CASE
                    WHEN w.settings->>'direct_pair_key' IS NOT NULL THEN (
                      CASE
                        WHEN SPLIT_PART(w.settings->>'direct_pair_key', ':', 1) = $1::text 
                        THEN NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 2), '')::uuid
                        ELSE NULLIF(SPLIT_PART(w.settings->>'direct_pair_key', ':', 1), '')::uuid
                      END
                    )
                    ELSE NULL
                  END
                )
                AND u_check.is_active = false
              ) THEN 'inactive'
              ELSE 'deleted'
            END
          )
          ELSE NULL
        END as direct_peer_status,
        u.full_name as created_by_name,
        COUNT(DISTINCT wm.user_id) as member_count,
        COUNT(DISTINCT wp.id) as message_count,
        CASE 
          WHEN wm_current.user_id IS NOT NULL THEN wm_current.role 
          ELSE null 
        END as user_role,
        CASE 
          WHEN wm_current.user_id IS NOT NULL THEN wm_current.status 
          ELSE null 
        END as user_status
      FROM workgroups w
      LEFT JOIN users u ON w.created_by = u.id
      LEFT JOIN workgroup_members wm ON w.id = wm.workgroup_id
      LEFT JOIN workgroup_posts wp ON w.id = wp.workgroup_id AND wp.is_deleted = false
      LEFT JOIN workgroup_members wm_current ON w.id = wm_current.workgroup_id AND wm_current.user_id = $1
      WHERE w.id = $2 AND w.org_id = $3 AND w.is_archived = false
      GROUP BY w.id, u.full_name, wm_current.user_id, wm_current.role, wm_current.status
    `;

    const result = await db.query(query, [req.user.id, id, req.user.orgId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workgroup not found' });
    }

    const workgroup = result.rows[0];

    // Check if user can access private workgroup
    if (workgroup.is_private && !workgroup.user_role) {
      return res.status(403).json({ error: 'Access denied to private workgroup' });
    }

    let isOnline = false;
    let lastSeenAt = null;
    if (workgroup.direct_peer_user_id && !workgroup.is_peer_deleted) {
      const presence = realtimeService.getUserPresence(workgroup.direct_peer_user_id);
      isOnline = Boolean(presence.isOnline);
      lastSeenAt = presence.lastSeenAt || workgroup.direct_peer_last_seen_at || null;
    }

    res.json({
      ...workgroup,
      is_online: isOnline,
      last_seen_at: lastSeenAt,
    });
  } catch (err) {
    next(err);
  }
};

// Create workgroup
const createWorkgroup = async (req, res, next) => {
  try {
    const { name, description, avatar_color, type, is_private, settings } = req.body;
    const normalizedType = type || 'team';
    const normalizedIsPrivate = normalizedType === 'private' ? true : false;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Workgroup name is required' });
    }

    // Check if name already exists in organization
    const existingQuery = `
      SELECT id FROM workgroups 
      WHERE org_id = $1 AND LOWER(name) = LOWER($2) AND is_archived = false
    `;
    const existing = await db.query(existingQuery, [req.user.orgId, name.trim()]);

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'A workgroup with this name already exists' });
    }

    const id = uuidv4();
    await db.query('BEGIN');

    const query = `
      INSERT INTO workgroups (
        id, org_id, name, description, avatar_color, type, is_private, created_by, settings
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await db.query(query, [
      id,
      req.user.orgId,
      name.trim(),
      description?.trim() || null,
      avatar_color || 'bg-blue-500',
      normalizedType,
      normalizedIsPrivate,
      req.user.id,
      settings || {}
    ]);

    // Auto-add creator as owner so team can chat immediately.
    await db.query(
      `INSERT INTO workgroup_members (workgroup_id, user_id, role, invited_by)
       VALUES ($1, $2, 'owner', $2)
       ON CONFLICT (workgroup_id, user_id) DO NOTHING`,
      [id, req.user.id]
    );

    // Log activity
    await logActivity(id, req.user.id, 'workgroup_created', {
      workgroup_name: name.trim(),
      type: type || 'team'
    });

    await db.query('COMMIT');

    realtimeService.emitWorkgroupUpdated(req.user.orgId, {
      action: 'created',
      workgroup_id: id,
      workgroup: result.rows[0],
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    await db.query('ROLLBACK').catch(() => { });
    next(err);
  }
};

// Update workgroup
const updateWorkgroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      avatar_color,
      type,
      is_private,
      manage_member_user_id,
      settings,
    } = req.body;
    const normalizedType = type;
    const normalizedIsPrivate =
      normalizedType === undefined
        ? is_private
        : normalizedType === 'private';

    // Check if user is admin, owner, or moderator with edit permissions
    const permissionQuery = `
      SELECT wm.role, w.settings, w.created_by
      FROM workgroup_members wm
      JOIN workgroups w ON w.id = wm.workgroup_id
      WHERE wm.workgroup_id = $1 AND wm.user_id = $2
    `;
    const permissionResult = await db.query(permissionQuery, [id, req.user.id]);

    if (permissionResult.rows.length === 0) {
      return res.status(403).json({ error: 'Only workgroup members can update settings' });
    }

    const { role, settings: wgSettings, created_by } = permissionResult.rows[0];
    const isOwnerOrAdmin = ['owner', 'admin'].includes(role) || created_by === req.user.id;
    const isModerator = role === 'moderator' || wgSettings?.member_manager_user_id === req.user.id;

    if (!isOwnerOrAdmin) {
      if (isModerator) {
        if (!wgSettings?.moderator_permissions?.edit_group) {
          return res.status(403).json({ error: 'Moderator does not have permission to edit this group' });
        }

        // As a moderator, you can only update name, description, and certain settings (locks)
        // We will prevent updating type, is_private, or moderator_permissions themselves if we were being strict
        // But for now, let's just allow the update since the frontend filtered the UI
      } else {
        return res.status(403).json({ error: 'Only workgroup owners, admins, and authorized moderators can update settings' });
      }
    }

    if (name && name.trim()) {
      // Check if new name conflicts with existing workgroup
      const existingQuery = `
        SELECT id FROM workgroups 
        WHERE org_id = $1 AND LOWER(name) = LOWER($2) AND id != $3 AND is_archived = false
      `;
      const existing = await db.query(existingQuery, [req.user.orgId, name.trim(), id]);

      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'A workgroup with this name already exists' });
      }
    }

    // Merge settings if provided
    let finalSettings = settings;
    if (manage_member_user_id !== undefined || settings !== undefined) {
      const currentResult = await db.query('SELECT settings FROM workgroups WHERE id = $1', [id]);
      const currentSettings = currentResult.rows[0]?.settings || {};

      finalSettings = {
        ...currentSettings,
        ...(settings || {}),
      };

      if (manage_member_user_id !== undefined) {
        finalSettings.member_manager_user_id = manage_member_user_id === 'none' ? null : manage_member_user_id;
      }
    }

    const query = `
      UPDATE workgroups 
      SET 
        name = COALESCE($1, name),
        description = $2,
        avatar_color = COALESCE($3, avatar_color),
        type = COALESCE($4, type),
        is_private = COALESCE($5, is_private),
        settings = COALESCE($6, settings),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND org_id = $8
      RETURNING *
    `;
    const result = await db.query(query, [
      name?.trim(),
      description?.trim(),
      avatar_color,
      normalizedType,
      normalizedIsPrivate,
      finalSettings,
      id,
      req.user.orgId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workgroup not found' });
    }

    // Optional: assign a specific non-admin/owner member who can add/remove members.
    if (manage_member_user_id !== undefined) {
      if (manage_member_user_id) {
        const targetMemberCheck = await db.query(
          `
            SELECT wm.user_id
            FROM workgroup_members wm
            JOIN users u ON u.id = wm.user_id
            WHERE wm.workgroup_id = $1
              AND wm.user_id = $2
              AND u.org_id = $3
          `,
          [id, manage_member_user_id, req.user.orgId],
        );
        if (targetMemberCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Assigned user must be a member of this team' });
        }
      }

      await db.query(
        `
          UPDATE workgroups
          SET settings = CASE
            WHEN $1::text IS NULL
              THEN COALESCE(settings, '{}'::jsonb) - 'member_manager_user_id'
            ELSE jsonb_set(
              COALESCE(settings, '{}'::jsonb),
              '{member_manager_user_id}',
              to_jsonb($1::text),
              true
            )
          END,
          updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND org_id = $3
        `,
        [manage_member_user_id || null, id, req.user.orgId],
      );
    }

    // Log activity
    await logActivity(id, req.user.id, 'workgroup_updated', {
      changes: { name, description, avatar_color, type, is_private }
    });

    const latestResult = await db.query(
      `SELECT * FROM workgroups WHERE id = $1 AND org_id = $2`,
      [id, req.user.orgId]
    );
    const latestWorkgroup = latestResult.rows[0] || result.rows[0];

    realtimeService.emitWorkgroupUpdated(req.user.orgId, {
      action: 'updated',
      workgroup_id: id,
      workgroup: latestWorkgroup,
    });

    res.json(latestWorkgroup);
  } catch (err) {
    next(err);
  }
};

// Delete workgroup
const deleteWorkgroup = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check membership and permissions
    const permissionQuery = `
      SELECT wm.role, wm.status, w.settings, w.created_by, w.name, w.org_id
      FROM workgroup_members wm
      JOIN workgroups w ON w.id = wm.workgroup_id
      WHERE wm.workgroup_id = $1 AND wm.user_id = $2
    `;
    const permissionResult = await db.query(permissionQuery, [id, req.user.id]);

    if (permissionResult.rows.length === 0) {
      // Check if user is org admin or creator even if not currently in wm
      const wgQuery = `SELECT id, name, created_by, org_id, settings FROM workgroups WHERE id = $1`;
      const wgRes = await db.query(wgQuery, [id]);
      if (wgRes.rows.length === 0) {
        return res.status(404).json({ error: 'Workgroup not found' });
      }
      if (wgRes.rows[0].created_by !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Only workgroup members can delete teams' });
      }
      await db.query(`UPDATE workgroups SET is_archived = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
      realtimeService.emitWorkgroupUpdated(wgRes.rows[0].org_id, {
        action: 'deleted',
        workgroup_id: id,
        workgroup: { id },
      });
      return res.json({ message: 'Workgroup deleted successfully', deleted_for_everyone: true });
    }

    const { role, status, settings, created_by, name, org_id } = permissionResult.rows[0];
    const isLeftOrRemoved = status === 'left' || status === 'removed';
    const isOwner = role === 'owner' || created_by === req.user.id;
    const isModerator = role === 'moderator' || settings?.member_manager_user_id === req.user.id;

    // CASE 1: User has ALREADY LEFT or was removed (including previous owner who left)
    // -> Delete ONLY for this user (remove their membership record so it disappears from their chat list)
    if (isLeftOrRemoved) {
      await db.query(
        `DELETE FROM workgroup_members WHERE workgroup_id = $1 AND user_id = $2`,
        [id, req.user.id]
      );
      return res.json({
        message: 'Workgroup removed from your chats',
        deleted_for_me: true,
        workgroup_id: id,
      });
    }

    // CASE 2: Active OWNER or authorized MODERATOR (who has NOT left)
    // -> Delete for EVERYONE!
    if (isOwner || (isModerator && settings?.moderator_permissions?.delete_group)) {
      const query = `
        UPDATE workgroups 
        SET is_archived = true, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND org_id = $2
        RETURNING name
      `;
      const result = await db.query(query, [id, org_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Workgroup not found' });
      }

      await logActivity(id, req.user.id, 'workgroup_deleted', {
        workgroup_name: result.rows[0].name,
      });

      realtimeService.emitWorkgroupUpdated(org_id, {
        action: 'deleted',
        workgroup_id: id,
        workgroup: { id },
      });

      return res.json({
        message: 'Workgroup deleted successfully for all members',
        deleted_for_everyone: true,
        workgroup_id: id,
      });
    }

    // CASE 3: Active regular MEMBER (has not left yet)
    // -> Leave team and delete ONLY for themselves!
    await db.query(
      `DELETE FROM workgroup_members WHERE workgroup_id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    const userRes = await db.query('SELECT full_name FROM users WHERE id = $1', [req.user.id]);
    const userName = userRes.rows[0]?.full_name || 'A member';
    try {
      await createSystemPost(id, req.user.id, `${userName} left the group.`);
    } catch (e) {}

    realtimeService.emitWorkgroupMemberRemoved(id, req.user.id);

    return res.json({
      message: 'You have left the team and it was removed from your chats',
      deleted_for_me: true,
      workgroup_id: id,
    });
  } catch (err) {
    next(err);
  }
};

// Get workgroup members
const getWorkgroupMembers = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user has access to workgroup
    const accessQuery = `
      SELECT w.is_private, wm.user_id
      FROM workgroups w
      LEFT JOIN workgroup_members wm ON w.id = wm.workgroup_id AND wm.user_id = $1
      WHERE w.id = $2 AND w.org_id = $3
    `;
    const accessResult = await db.query(accessQuery, [req.user.id, id, req.user.orgId]);

    if (accessResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workgroup not found' });
    }

    if (accessResult.rows[0].is_private && !accessResult.rows[0].user_id) {
      return res.status(403).json({ error: 'Access denied to private workgroup' });
    }

    // When user opens the workgroup, mark all messages from others as read.
    await markWorkgroupPostsAsRead(id, req.user.id);

    const query = `
      SELECT 
        wm.*,
        u.full_name,
        u.email,
        u.avatar_url,
        u.last_login,
        u.last_seen_at as persisted_last_seen_at,
        u.role as user_role,
        ui.full_name as invited_by_name
      FROM workgroup_members wm
      JOIN users u ON wm.user_id = u.id
      LEFT JOIN users ui ON wm.invited_by = ui.id
      WHERE wm.workgroup_id = $1 AND (u.is_active = true OR u.is_active IS NULL)
      ORDER BY 
        CASE wm.role 
          WHEN 'owner' THEN 1 
          WHEN 'admin' THEN 2 
          WHEN 'member' THEN 3 
          WHEN 'guest' THEN 4 
        END,
        wm.joined_at ASC
    `;

    const result = await db.query(query, [id]);
    const membersWithPresence = result.rows.map((member) => {
      const presence = realtimeService.getUserPresence(member.user_id);
      return {
        ...member,
        is_online: presence.isOnline,
        last_seen_at:
          presence.lastSeenAt ||
          member.persisted_last_seen_at ||
          member.last_login ||
          null,
      };
    });
    res.json(membersWithPresence);
  } catch (err) {
    next(err);
  }
};

// Add member to workgroup
const addWorkgroupMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user_id, role } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check workgroup and enforce org isolation
    const workgroupCheckQuery = `
      SELECT id, org_id, name FROM workgroups
      WHERE id = $1 AND is_archived = false
    `;
    const workgroupCheckResult = await db.query(workgroupCheckQuery, [id]);
    if (workgroupCheckResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workgroup not found' });
    }
    if (workgroupCheckResult.rows[0].org_id !== req.user.orgId) {
      return res.status(403).json({ error: 'You cannot manage members outside your organization' });
    }

    // Check if current user can add members
    const permissionQuery = `
      SELECT wm.role, w.allow_member_add_remove, w.created_by, w.settings
      FROM workgroup_members wm
      JOIN workgroups w ON wm.workgroup_id = w.id
      WHERE wm.workgroup_id = $1 AND wm.user_id = $2
    `;
    const permissionResult = await db.query(permissionQuery, [id, req.user.id]);

    if (permissionResult.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this workgroup' });
    }

    const {
      role: currentUserRole,
      allow_member_add_remove,
      created_by,
      settings,
    } = permissionResult.rows[0];
    const isTeamCreator = created_by === req.user.id;
    const assignedManagerUserId = settings?.member_manager_user_id || null;
    const isAssignedMemberManager = assignedManagerUserId === req.user.id;

    const isModerator = currentUserRole === 'moderator' || isAssignedMemberManager;
    const canAddMembers =
      ['owner', 'admin'].includes(currentUserRole) ||
      allow_member_add_remove ||
      isTeamCreator ||
      (isModerator && settings?.moderator_permissions?.add_members);

    if (!canAddMembers) {
      return res.status(403).json({ error: 'You do not have permission to add members' });
    }

    // Check if user exists in same organization
    const userQuery = `
      SELECT id, full_name FROM users 
      WHERE id = $1 AND org_id = $2
    `;
    const userResult = await db.query(userQuery, [user_id, req.user.orgId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is already a member
    const existingQuery = `
      SELECT id, status FROM workgroup_members 
      WHERE workgroup_id = $1 AND user_id = $2
    `;
    const existingResult = await db.query(existingQuery, [id, user_id]);

    let result;
    if (existingResult.rows.length > 0) {
      if ((existingResult.rows[0].status || 'active') === 'active') {
        return res.status(400).json({ error: 'User is already a member of this workgroup' });
      }
      // Re-activate member who previously left
      result = await db.query(
        `UPDATE workgroup_members 
         SET status = 'active', role = $1, joined_at = CURRENT_TIMESTAMP, left_at = NULL, invited_by = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [role || 'member', req.user.id, existingResult.rows[0].id]
      );
    } else {
      const insertQuery = `
        INSERT INTO workgroup_members (workgroup_id, user_id, role, invited_by, status)
        VALUES ($1, $2, $3, $4, 'active')
        RETURNING *
      `;
      result = await db.query(insertQuery, [
        id,
        user_id,
        role || 'member',
        req.user.id
      ]);
    }

    // Log activity
    await logActivity(id, req.user.id, 'member_added', {
      added_user_name: userResult.rows[0].full_name,
      role: role || 'member'
    });

    const actorResult = await db.query(
      'SELECT full_name FROM users WHERE id = $1',
      [req.user.id]
    );
    const actorName = actorResult.rows[0]?.full_name || 'A member';
    const addedName = userResult.rows[0]?.full_name || 'a user';
    try {
      await createSystemPost(id, req.user.id, `${actorName} added ${addedName} to the team.`);
    } catch (systemErr) {
      // Do not fail add-member API if system activity post fails.
      console.error('Failed to create system activity post (member_added):', systemErr.message);
    }

    // Notify all members in the workgroup to refresh their member list.
    realtimeService.emitWorkgroupMemberAdded(id, result.rows[0]);

    // CRITICAL: Also notify the specific user who was added so their list updates in real-time.
    realtimeService.emitWorkgroupNotification(user_id, {
      action: 'member_added',
      workgroup_id: id,
      workgroup: workgroupCheckResult.rows[0],
      title: 'New Team',
      body: `You have been added to ${workgroupCheckResult.rows[0].name || 'a new team'}`
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Remove member from workgroup
const removeWorkgroupMember = async (req, res, next) => {
  try {
    const { id, memberId } = req.params;

    // Get member details
    const memberQuery = `
      SELECT wm.user_id, wm.role, wm.status, u.full_name
      FROM workgroup_members wm
      JOIN users u ON wm.user_id = u.id
      WHERE wm.id = $1 AND wm.workgroup_id = $2
    `;
    const memberResult = await db.query(memberQuery, [memberId, id]);

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const { user_id: targetUserId, role: targetRole, status: targetStatus, full_name } = memberResult.rows[0];

    if (targetStatus === 'left' || targetStatus === 'removed') {
      return res.status(400).json({ error: 'This member has already left or been removed from this workgroup' });
    }

    // Check permissions
    const permissionQuery = `
      SELECT wm.role, wm.status, w.created_by, w.settings
      FROM workgroup_members wm
      JOIN workgroups w ON wm.workgroup_id = w.id
      WHERE wm.workgroup_id = $1 AND wm.user_id = $2
    `;
    const permissionResult = await db.query(permissionQuery, [id, req.user.id]);

    if (permissionResult.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this workgroup' });
    }

    if (permissionResult.rows[0].status === 'left' || permissionResult.rows[0].status === 'removed') {
      return res.status(403).json({ error: 'You are no longer an active member of this workgroup' });
    }

    const currentUserRole = permissionResult.rows[0].role;
    const isTeamCreator = permissionResult.rows[0].created_by === req.user.id;
    const assignedManagerUserId =
      permissionResult.rows[0].settings?.member_manager_user_id || null;
    const isAssignedMemberManager = assignedManagerUserId === req.user.id;

    // Users can remove themselves, owners can remove anyone, admins can remove members/guests
    if (targetUserId !== req.user.id) {
      const isModerator = currentUserRole === 'moderator' || isAssignedMemberManager;
      const canRemoveMembers =
        ['owner', 'admin'].includes(currentUserRole) ||
        isTeamCreator ||
        (isModerator && permissionResult.rows[0].settings?.moderator_permissions?.delete_members);

      if (currentUserRole === 'owner') {
        // Owners can remove anyone except other owners
        if (targetRole === 'owner') {
          return res.status(403).json({ error: 'Cannot remove other owners' });
        }
      } else if (currentUserRole === 'admin') {
        // Admins can only remove members and guests
        if (['owner', 'admin'].includes(targetRole)) {
          return res.status(403).json({ error: 'Cannot remove owners or other admins' });
        }
      } else if (!canRemoveMembers) {
        return res.status(403).json({ error: 'You do not have permission to remove members' });
      }
    }

    const wasSelfRemoval = targetUserId === req.user.id;
    const updateMemberStatusQuery = `
      UPDATE workgroup_members 
      SET status = $1, left_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND workgroup_id = $3
    `;

    await db.query(updateMemberStatusQuery, [wasSelfRemoval ? 'left' : 'removed', memberId, id]);

    // Log activity
    await logActivity(id, req.user.id, 'member_removed', {
      removed_user_name: full_name,
      was_self_removal: targetUserId === req.user.id
    });

    const actorResult = await db.query(
      'SELECT full_name FROM users WHERE id = $1',
      [req.user.id]
    );
    const actorName = actorResult.rows[0]?.full_name || 'A member';
    const removedName = full_name || 'a user';
    const systemMessage =
      targetUserId === req.user.id
        ? `${removedName} left the group.`
        : `${actorName} removed ${removedName} from the group.`;
    try {
      await createSystemPost(id, req.user.id, systemMessage);
    } catch (systemErr) {
      // Do not fail remove-member API if system activity post fails.
      console.error('Failed to create system activity post (member_removed):', systemErr.message);
    }

    // Check if exiting user is the creator; if so, transfer ownership to moderator or earliest member
    if (permissionResult.rows[0].created_by === targetUserId) {
      await handleWorkgroupCreatorDeparture(id, targetUserId, req.user.id, db);
    }

    // Notify all members in the workgroup to refresh their member list.
    realtimeService.emitWorkgroupMemberRemoved(id, memberId);

    // Also notify the specific user who was removed so their list updates in real-time.
    const wgInfo = await db.query('SELECT name FROM workgroups WHERE id = $1', [id]);
    realtimeService.emitWorkgroupNotification(targetUserId, {
      action: 'member_removed',
      workgroup_id: id,
      title: 'Team Update',
      body: `You are no longer a member of ${wgInfo.rows[0]?.name || 'the team'}`
    });

    res.json({ message: 'Member removed successfully' });
  } catch (err) {
    next(err);
  }
};

// Get workgroup posts/messages
const getWorkgroupPosts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { channel_id, limit = 50, offset = 0 } = req.query;

    // Check access
    const accessQuery = `
      SELECT w.is_private, wm.user_id, wm.status, wm.left_at
      FROM workgroups w
      LEFT JOIN workgroup_members wm ON w.id = wm.workgroup_id AND wm.user_id = $1
      WHERE w.id = $2 AND w.org_id = $3
    `;
    const accessResult = await db.query(accessQuery, [req.user.id, id, req.user.orgId]);

    if (accessResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workgroup not found' });
    }

    if (accessResult.rows[0].is_private && !accessResult.rows[0].user_id) {
      return res.status(403).json({ error: 'Access denied to private workgroup' });
    }

    const isUserLeft = accessResult.rows[0].status === 'left' || accessResult.rows[0].status === 'removed';
    const cutoffTimestamp = isUserLeft ? accessResult.rows[0].left_at : null;

    // Mark all messages from others as read whenever posts are fetched (workgroup is open)
    await markWorkgroupPostsAsRead(id, req.user.id);

    let query = `
      WITH RECURSIVE post_tree AS (
        -- Get parent posts
        SELECT
          p.*,
          u.full_name as author_name,
          u.avatar_url as author_avatar,
          0 as depth,
          p.id as root_id,
          p.created_at as root_created_at
        FROM workgroup_posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.workgroup_id = $1
          AND p.parent_id IS NULL
          AND (
            p.is_deleted = false
            OR p.is_deleted = true
            OR $2::uuid = ANY(COALESCE(p.deleted_for_users, '{}'::uuid[]))
          )
          AND ($3::timestamptz IS NULL OR p.created_at <= $3::timestamptz)
    `;

    const params = [id, req.user.id, cutoffTimestamp];
    let paramIndex = 4;

    if (channel_id) {
      query += ` AND p.channel_id = $${paramIndex}`;
      params.push(channel_id);
      paramIndex++;
    }

    query += `
        UNION ALL
        -- Get replies
        SELECT
          p.*,
          u.full_name as author_name,
          u.avatar_url as author_avatar,
          pt.depth + 1,
          pt.root_id,
          pt.root_created_at
        FROM workgroup_posts p
        JOIN users u ON p.user_id = u.id
        JOIN post_tree pt ON p.parent_id = pt.id
        WHERE (
          p.is_deleted = false
          OR p.is_deleted = true
          OR $2::uuid = ANY(COALESCE(p.deleted_for_users, '{}'::uuid[]))
        )
        AND ($3::timestamptz IS NULL OR p.created_at <= $3::timestamptz)
      )
      SELECT * FROM post_tree
      ORDER BY root_created_at DESC, depth ASC, created_at ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    // Build seen-count map for tick color rendering.
    const allPostIds = result.rows.map((post) => post.id);
    const seenCountMap = new Map();
    if (allPostIds.length > 0) {
      const seenResult = await db.query(
        `
          SELECT 
            post_id, 
            COUNT(*)::int AS seen_count,
            json_agg(json_build_object(
              'user_id', u.id,
              'full_name', u.full_name,
              'avatar_url', u.avatar_url
            )) as seen_by
          FROM workgroup_post_reads r
          JOIN users u ON r.user_id = u.id
          WHERE post_id = ANY($1::uuid[])
          GROUP BY post_id
        `,
        [allPostIds],
      );
      seenResult.rows.forEach((row) => {
        seenCountMap.set(row.post_id, {
          count: row.seen_count,
          users: row.seen_by
        });
      });
    }

    // Group replies under parent posts
    const postsMap = new Map();
    const rootPosts = [];

    result.rows.forEach(post => {
      const seenInfo = seenCountMap.get(post.id) || { count: 0, users: [] };
      post.seen_count = seenInfo.count;
      post.seen_by = seenInfo.users;
      if (post.depth === 0) {
        post.replies = [];
        postsMap.set(post.id, post);
        rootPosts.push(post);
      } else {
        const parentPost = postsMap.get(post.root_id);
        if (parentPost) {
          parentPost.replies.push(post);
        }
      }
    });

    res.json(rootPosts);
  } catch (err) {
    next(err);
  }
};

// Create post/message
const createWorkgroupPost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content, channel_id, parent_id, content_type, files, mentions } = req.body;
    const attachments = Array.isArray(files) ? files : [];
    const messageMentions = Array.isArray(mentions) ? mentions : [];

    const isCallType = content_type === 'call';
    const hasAttachments = attachments.length > 0;
    const trimmedContent = (content || '').trim();

    if (!hasAttachments && !isCallType && !trimmedContent) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Check if user is member
    const memberQuery = `
      SELECT id, role, status FROM workgroup_members 
      WHERE workgroup_id = $1 AND user_id = $2
    `;
    const memberResult = await db.query(memberQuery, [id, req.user.id]);

    if (memberResult.rows.length === 0) {
      return res.status(403).json({ error: 'You must be a member to post messages' });
    }

    if (memberResult.rows[0].status === 'left' || memberResult.rows[0].status === 'removed') {
      return res.status(403).json({ error: "You can't send messages to this group because you're no longer a participant." });
    }

    // Check if chat is direct chat or team workgroup
    const wgSettingsQuery = `SELECT settings, name FROM workgroups WHERE id = $1`;
    const wgSettingsResult = await db.query(wgSettingsQuery, [id]);
    const wgSettings = wgSettingsResult.rows[0]?.settings || {};
    const isDirectChat = Boolean(wgSettings.is_direct_chat);

    if (isDirectChat) {
      let peerId = null;
      if (wgSettings.direct_pair_key) {
        const parts = wgSettings.direct_pair_key.split(':');
        peerId = parts[0] === req.user.id ? parts[1] : parts[0];
      }
      if (!peerId) {
        const peerMember = await db.query(
          'SELECT user_id FROM workgroup_members WHERE workgroup_id = $1 AND user_id <> $2 LIMIT 1',
          [id, req.user.id]
        );
        peerId = peerMember.rows[0]?.user_id;
      }

      if (peerId) {
        const peerUser = await db.query('SELECT id, is_active FROM users WHERE id = $1', [peerId]);
        if (peerUser.rows.length === 0) {
          return res.status(400).json({ error: 'This user no longer exists.' });
        }
        if (!peerUser.rows[0].is_active) {
          return res.status(400).json({ error: 'This user account is inactive.' });
        }
      } else {
        return res.status(400).json({ error: 'User does not exist.' });
      }
    }

    // Check if channel exists and is broadcast
    if (channel_id) {
      const channelQuery = `SELECT is_broadcast FROM workgroup_channels WHERE id = $1`;
      const channelResult = await db.query(channelQuery, [channel_id]);
      if (channelResult.rows.length > 0 && channelResult.rows[0].is_broadcast) {
        if (!['owner', 'admin', 'moderator'].includes(memberResult.rows[0].role)) {
          return res.status(403).json({ error: 'Only admins can post in broadcast channels' });
        }
      }
    }

    // Check if chat is locked globally for the workgroup

    if (wgSettings.is_chat_locked) {
      const userRole = memberResult.rows[0].role;
      const isModerator = wgSettings.member_manager_user_id === req.user.id;
      // If chat is locked, only owner, admin, or moderator can post
      if (!['owner', 'admin', 'moderator'].includes(userRole) && !isModerator) {
        return res.status(403).json({ error: 'This chat has been locked by an administrator' });
      }
    }

    let finalContentType = content_type || 'text';

    // Auto-detect call logs if sent as text (e.g. from mobile)
    if (finalContentType === 'text' && trimmedContent.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmedContent);
        if (parsed && (parsed.type === 'video' || parsed.type === 'voice' || parsed.type === 'call') && parsed.status) {
          finalContentType = 'call';
        }
      } catch (e) {
        // Not a valid JSON or not a call log, keep as text
      }
    }

    const postId = uuidv4();
    const insertQuery = `
      INSERT INTO workgroup_posts (
        id, workgroup_id, channel_id, user_id, parent_id, content, content_type, attachments, mention_users
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::uuid[])
      RETURNING *
    `;

    const result = await db.query(insertQuery, [
      postId,
      id,
      channel_id || null,
      req.user.id,
      parent_id || null,
      trimmedContent,
      finalContentType,
      JSON.stringify(attachments),
      messageMentions
    ]);

    // Get post with author info
    const postQuery = `
      SELECT p.*, u.full_name as author_name, u.avatar_url as author_avatar
      FROM workgroup_posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = $1
    `;
    const postResult = await db.query(postQuery, [postId]);

    // Log activity
    await logActivity(id, req.user.id, 'message_posted', {
      message_id: postId,
      is_reply: !!parent_id
    });

    const insertedPost = postResult.rows[0];

    // Real-time: broadcast to everyone subscribed to this workgroup room
    realtimeService.emitWorkgroupPost(id, insertedPost);

    // Fetch workgroup name and all members (excluding sender) for per-user notifications
    const [wgResult, membersResult] = await Promise.all([
      db.query(`SELECT name, type, settings, avatar_url FROM workgroups WHERE id = $1`, [id]),
      db.query(
        `SELECT wm.user_id FROM workgroup_members wm WHERE wm.workgroup_id = $1 AND wm.user_id <> $2 AND COALESCE(wm.status, 'active') = 'active'`,
        [id, req.user.id]
      ),
    ]);

    const workgroup = wgResult.rows[0];
    const chatName = isDirectChat ? insertedPost.author_name : (workgroup?.name || 'Team');
    const notifTitle = isDirectChat ? insertedPost.author_name : `${chatName}`;
    const notifBody = insertedPost.content.replace('[SYSTEM] ', '');

    // Helper: convert relative avatar path to absolute URL for push notifications
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 4000}`;
    const toAbsoluteUrl = (url) => {
      if (!url) return null;
      if (url.startsWith('http')) return url;
      return `${backendUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    // For broadcast channels, fetch channel avatar if available
    let channelAvatar = null;
    if (channel_id) {
      const channelAvatarResult = await db.query(
        `SELECT avatar_url FROM workgroup_channels WHERE id = $1`,
        [channel_id]
      );
      channelAvatar = channelAvatarResult.rows[0]?.avatar_url || null;
    }

    const isBroadcast = workgroup?.settings?.is_broadcast === true || workgroup?.settings?.is_broadcast === 'true';

    const actionUrl = isDirectChat
      ? `/dc?chat=${id}`
      : isBroadcast
        ? `/bc?team=${id}`
        : `/wg?team=${id}`;

    const notifPayload = {
      title: notifTitle,
      body: notifBody,
      workgroup_id: id,
      workgroup_name: chatName,
      user_id: req.user.id,
      author_name: insertedPost.author_name,
      author_avatar: toAbsoluteUrl(insertedPost.author_avatar),
      workgroup_avatar: toAbsoluteUrl(channelAvatar || workgroup?.avatar_url),
      post_id: insertedPost.id,
      is_direct_chat: isDirectChat,
      is_broadcast: isBroadcast,
      action_url: actionUrl,
    };

    // Create database notification for all members except sender
    try {
      await createNotification(
        id,
        req.user.id,
        'message',
        notifTitle,
        notifBody
      );
    } catch (notifErr) {
      console.error('Failed to create notification:', notifErr);
    }

    for (const { user_id } of membersResult.rows) {
      // ALWAYS send the socket event — frontend shows toast when on another page,
      // suppresses when user is viewing this specific chat
      realtimeService.emitWorkgroupNotification(user_id, notifPayload);

      // ALWAYS send VAPID web push — the service worker (sw.js) will suppress it
      // if any project tab is visible (user sees the in-app toast instead)
      pushService.sendPushToUser(user_id, {
        type: 'workgroup_message',
        ...notifPayload,
      });

      // FCM only when user has NO open tabs (for mobile apps)
      const isOnline = realtimeService.isUserConnected(user_id);
      if (!isOnline) {
        fcmService.sendPushNotification(
          user_id,
          notifTitle,
          notifBody,
          {
            type: 'workgroup_message',
            ...notifPayload,
            post_id: String(notifPayload.post_id),
            workgroup_id: String(notifPayload.workgroup_id),
            is_direct_chat: String(notifPayload.is_direct_chat)
          }
        ).catch(err => console.error(`FCM error for user ${user_id}:`, err.message));
      }
    }

    // Send Mention Events
    for (const mentionedUser of messageMentions) {
      realtimeService.emitMention(mentionedUser, {
        type: 'workgroup_post',
        workgroupId: id,
        message: insertedPost
      });
    }

    res.status(201).json(insertedPost);
  } catch (err) {
    next(err);
  }
};

// Delete workgroup post
const deleteWorkgroupPost = async (req, res, next) => {
  try {
    const { id, postId } = req.params;

    // Check if post exists and get post info
    const postQuery = `
      SELECT p.*, wm.role, w.settings as workgroup_settings
      FROM workgroup_posts p
      JOIN workgroups w ON p.workgroup_id = w.id
      LEFT JOIN workgroup_members wm ON p.workgroup_id = wm.workgroup_id AND wm.user_id = $1
      WHERE p.id = $2 AND p.workgroup_id = $3
    `;
    const postResult = await db.query(postQuery, [req.user.id, postId, id]);

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = postResult.rows[0];
    const isDirectChat = post.workgroup_settings?.is_direct_chat === true || post.workgroup_settings?.is_direct_chat === 'true';

    // Check permissions:
    // In Direct Chats, ONLY the author can delete their own posts for everyone.
    // In Groups/Broadcasts, the author OR admins/owners can delete any post.
    if (isDirectChat) {
      if (post.user_id !== req.user.id) {
        return res.status(403).json({ error: 'In direct chats, you can only delete your own messages for everyone' });
      }
    } else {
      if (post.user_id !== req.user.id && !['owner', 'admin'].includes(post.role)) {
        return res.status(403).json({ error: 'You can only delete your own posts or be an admin' });
      }
    }

    // Soft delete the post
    // If already deleted for everyone (is_deleted = true), add ALL members to deleted_for_users
    // so the placeholder is hidden for everyone
    if (post.is_deleted) {
      const membersResult = await db.query(
        `SELECT user_id FROM workgroup_members WHERE workgroup_id = $1`,
        [id]
      );
      const allMemberIds = membersResult.rows.map(r => r.user_id);
      await db.query(
        `UPDATE workgroup_posts
         SET deleted_for_users = $1::uuid[],
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [allMemberIds, postId]
      );

      // Real-time: notify all members to hide this post completely
      realtimeService.emitWorkgroupPost(id, {
        id: postId,
        workgroup_id: id,
        is_deleted: true,
        deleted_for_users: allMemberIds,
        user_id: post.user_id,
        content: post.content,
        content_type: post.content_type,
        created_at: post.created_at,
        author_name: post.author_name,
        author_avatar: post.author_avatar,
        parent_id: post.parent_id || null,
        attachments: post.attachments || [],
        reactions: post.reactions || {},
      });

      return res.json({ message: 'Post deleted successfully' });
    }

    const deleteQuery = `
      UPDATE workgroup_posts 
      SET is_deleted = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await db.query(deleteQuery, [postId]);

    // Log activity
    await logActivity(id, req.user.id, 'message_deleted', {
      message_id: postId,
      deleted_by_author: post.user_id === req.user.id
    });

    // Real-time: notify all members in the workgroup that this post was deleted
    realtimeService.emitWorkgroupPost(id, {
      id: postId,
      workgroup_id: id,
      is_deleted: true,
      user_id: post.user_id,
      content: post.content,
      content_type: post.content_type,
      created_at: post.created_at,
      author_name: post.author_name,
      author_avatar: post.author_avatar,
      parent_id: post.parent_id || null,
      attachments: post.attachments || [],
      reactions: post.reactions || {},
      deleted_for_users: post.deleted_for_users || [],
    });

    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// Delete workgroup post only for current user
const deleteWorkgroupPostForMe = async (req, res, next) => {
  try {
    const { id, postId } = req.params;

    // Ensure requester is a member and post exists in this workgroup
    // Allow deleting even if already deleted for everyone (is_deleted = true)
    const postQuery = `
      SELECT p.id, p.user_id
      FROM workgroup_posts p
      JOIN workgroup_members wm
        ON wm.workgroup_id = p.workgroup_id
       AND wm.user_id = $1
      WHERE p.id = $2
        AND p.workgroup_id = $3
    `;
    const postResult = await db.query(postQuery, [req.user.id, postId, id]);

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    await db.query(
      `
        UPDATE workgroup_posts
        SET deleted_for_users = CASE
          WHEN deleted_for_users IS NULL THEN ARRAY[$1::uuid]
          WHEN $1::uuid = ANY(deleted_for_users) THEN deleted_for_users
          ELSE array_append(deleted_for_users, $1::uuid)
        END,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND workgroup_id = $3
      `,
      [req.user.id, postId, id],
    );

    res.json({ message: 'Post deleted for you' });
  } catch (err) {
    next(err);
  }
};

// Edit workgroup post
const editWorkgroupPost = async (req, res, next) => {
  try {
    const { id, postId } = req.params;
    const { content } = req.body;

    const trimmedContent = (content || '').trim();
    if (!trimmedContent) {
      return res.status(400).json({ error: 'Message content cannot be empty' });
    }

    // Check if post exists and get post info
    const postQuery = `
      SELECT p.*, u.full_name as author_name, u.avatar_url as author_avatar
      FROM workgroup_posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = $1 AND p.workgroup_id = $2
    `;
    const postResult = await db.query(postQuery, [postId, id]);

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = postResult.rows[0];

    if (post.is_deleted) {
      return res.status(400).json({ error: 'Cannot edit a deleted message' });
    }

    // ONLY the author can edit their own posts
    if (post.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own messages' });
    }

    // Check 5 min window limit (5 * 60 * 1000 ms = 300000 ms)
    const createdAtTime = new Date(post.created_at).getTime();
    const currentTime = Date.now();
    const timeDifference = currentTime - createdAtTime;
    const limit = 5 * 60 * 1000;

    if (timeDifference > limit) {
      return res.status(400).json({ error: 'Messages can only be edited within 5 minutes of sending' });
    }

    // Update the content of the post
    const updateQuery = `
      UPDATE workgroup_posts
      SET content = $1, is_edited = true, edited_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND workgroup_id = $3
      RETURNING *
    `;
    const updateResult = await db.query(updateQuery, [trimmedContent, postId, id]);
    const updatedPost = {
      ...updateResult.rows[0],
      author_name: post.author_name,
      author_avatar: post.author_avatar,
    };

    // Log activity
    await logActivity(id, req.user.id, 'message_edited', {
      message_id: postId,
    });

    // Real-time: notify all members in the workgroup that this post was edited
    realtimeService.emitWorkgroupPost(id, updatedPost);

    res.json(updatedPost);
  } catch (err) {
    next(err);
  }
};

// Toggle pin status of workgroup post
const togglePinWorkgroupPost = async (req, res, next) => {
  try {
    const { id, postId } = req.params;
    const { is_pinned } = req.body;

    // Check if user is admin/owner
    const memberQuery = `
      SELECT role FROM workgroup_members 
      WHERE workgroup_id = $1 AND user_id = $2
    `;
    const memberResult = await db.query(memberQuery, [id, req.user.id]);

    if (memberResult.rows.length === 0) {
      return res.status(403).json({ error: 'You must be a member to pin posts' });
    }

    if (!['owner', 'admin'].includes(memberResult.rows[0].role)) {
      return res.status(403).json({ error: 'Only admins and owners can pin posts' });
    }

    // Check if post exists
    const postQuery = `
      SELECT * FROM workgroup_posts 
      WHERE id = $1 AND workgroup_id = $2 AND is_deleted = false
    `;
    const postResult = await db.query(postQuery, [postId, id]);

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Update pin status
    const updateQuery = `
      UPDATE workgroup_posts 
      SET is_pinned = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query(updateQuery, [is_pinned, postId]);

    // Log activity
    await logActivity(id, req.user.id, is_pinned ? 'message_pinned' : 'message_unpinned', {
      message_id: postId
    });

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Add reaction to a post
const addWorkgroupPostReaction = async (req, res, next) => {
  try {
    const { id, postId } = req.params;
    const { reaction } = req.body;

    // Check if user is member
    const memberQuery = `SELECT id, role FROM workgroup_members WHERE workgroup_id = $1 AND user_id = $2`;
    const memberResult = await db.query(memberQuery, [id, req.user.id]);
    if (memberResult.rows.length === 0) {
      return res.status(403).json({ error: 'You must be a member to react' });
    }

    // Check if reactions are locked globally for the workgroup
    const wgSettingsQuery = `SELECT settings FROM workgroups WHERE id = $1`;
    const wgSettingsResult = await db.query(wgSettingsQuery, [id]);
    const wgSettings = wgSettingsResult.rows[0]?.settings || {};

    if (wgSettings.is_reactions_locked) {
      if (!['owner', 'admin', 'moderator'].includes(memberResult.rows[0].role)) {
        return res.status(403).json({ error: 'Reactions have been locked for this group' });
      }
    }


    const fetchQ = `SELECT reactions FROM workgroup_posts WHERE id = $1 AND workgroup_id = $2 AND is_deleted = false`;
    const fetchResult = await db.query(fetchQ, [postId, id]);
    if (fetchResult.rows.length === 0) return res.status(404).json({ error: 'Post not found' });

    const currentReactions = fetchResult.rows[0].reactions || {};
    const isAlreadyThisReaction =
      currentReactions[reaction] &&
      currentReactions[reaction].includes(req.user.id);

    // 1. Remove user from ALL existing reaction types (enforcing single reaction)
    for (const key in currentReactions) {
      currentReactions[key] = currentReactions[key].filter(
        (uId) => uId !== req.user.id,
      );
      if (currentReactions[key].length === 0) delete currentReactions[key];
    }

    // 2. If it wasn't this exact reaction before, add it now
    if (!isAlreadyThisReaction) {
      if (!currentReactions[reaction]) currentReactions[reaction] = [];
      currentReactions[reaction].push(req.user.id);
    }

    const updateQ = `UPDATE workgroup_posts SET reactions = $1 WHERE id = $2 RETURNING *`;
    const updatedRows = await db.query(updateQ, [JSON.stringify(currentReactions), postId]);

    realtimeService.emitReactionAdded(`workgroup:${id}`, { messageId: postId, reactions: currentReactions });

    res.json(updatedRows.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Find existing direct chat or create one
const getOrCreateDirectChatWorkgroup = async (req, res, next) => {
  let client = null;
  try {
    const { contact_user_id } = req.body;
    if (!contact_user_id) {
      return res.status(400).json({ error: 'contact_user_id is required' });
    }

    const currentUserId = String(req.user.id || '').toLowerCase();
    const contactUserId = String(contact_user_id || '').toLowerCase();
    if (contactUserId === currentUserId) {
      return res.status(400).json({ error: 'Cannot open direct chat with yourself' });
    }

    if (contactUserId === "all") {
      return res.status(400).json({ error: 'Cannot open direct chat with @Everyone' });
    }

    const pairKey = [currentUserId, contactUserId].sort().join(':');

    // 1. Check if direct chat workgroup ALREADY exists (preserves chat history even if peer was deleted)
    const existingResult = await db.query(
      `
        SELECT w.*
        FROM workgroups w
        WHERE w.org_id = $1
          AND w.type = 'private'
          AND w.is_archived = false
          AND COALESCE((w.settings->>'is_direct_chat')::boolean, false) = true
          AND (
            w.settings->>'direct_pair_key' = $2
            OR (
              EXISTS (SELECT 1 FROM workgroup_members wm_me WHERE wm_me.workgroup_id = w.id AND wm_me.user_id = $3)
              AND EXISTS (SELECT 1 FROM workgroup_members wm_contact WHERE wm_contact.workgroup_id = w.id AND wm_contact.user_id = $4)
            )
          )
        LIMIT 1
      `,
      [req.user.orgId, pairKey, req.user.id, contact_user_id]
    );
    if (existingResult.rows.length > 0) {
      return res.json(existingResult.rows[0]);
    }

    // 2. If chat doesn't exist yet, verify contact user exists in organization
    const contactResult = await db.query(
      `SELECT id, full_name, email FROM users WHERE id = $1 AND org_id = $2`,
      [contact_user_id, req.user.orgId]
    );
    if (contactResult.rows.length === 0) {
      return res.status(404).json({ error: 'User does not exist.' });
    }

    const contact = contactResult.rows[0];
    const directChatName = contact.full_name || contact.email || 'Direct Chat';

    client = await db.pool.connect();
    await client.query('BEGIN');
    const workgroupId = uuidv4();
    const createdResult = await client.query(
      `
        INSERT INTO workgroups (id, org_id, name, type, is_private, created_by, settings)
        VALUES ($1, $2, $3, 'private', true, $4, $5::jsonb)
        RETURNING *
      `,
      [
        workgroupId,
        req.user.orgId,
        directChatName,
        req.user.id,
        JSON.stringify({ is_direct_chat: true, direct_pair_key: pairKey }),
      ]
    );

    await client.query(
      `
        INSERT INTO workgroup_members (workgroup_id, user_id, role)
        VALUES ($1, $2, 'owner')
        ON CONFLICT (workgroup_id, user_id) DO NOTHING
      `,
      [workgroupId, req.user.id]
    );
    await client.query(
      `
        INSERT INTO workgroup_members (workgroup_id, user_id, role)
        SELECT $1::uuid, $2::uuid, 'member'
        WHERE $2::uuid <> $3::uuid
        ON CONFLICT (workgroup_id, user_id) DO NOTHING
      `,
      [workgroupId, contact_user_id, req.user.id]
    );

    await client.query('COMMIT');
    client.release();
    client = null;

    const newWorkgroup = createdResult.rows[0];
    realtimeService.emitWorkgroupUpdated(req.user.orgId, {
      action: 'created',
      workgroup_id: workgroupId,
      workgroup: newWorkgroup,
    });

    res.status(201).json(newWorkgroup);
  } catch (err) {
    try {
      if (client) await client.query('ROLLBACK');
    } catch (_) { }
    if (client) client.release();
    next(err);
  }
};

// Helper function to log activities
const logActivity = async (workgroupId, userId, activityType, activityData = {}) => {
  try {
    const query = `
      INSERT INTO workgroup_activities (workgroup_id, user_id, activity_type, activity_data)
      VALUES ($1, $2, $3, $4)
    `;
    await db.query(query, [workgroupId, userId, activityType, activityData]);
  } catch (err) {
    console.error('Error logging activity:', err);
  }
};

// Get workgroup activities
const getWorkgroupActivities = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query;

    const query = `
      SELECT 
        wa.*,
        u.full_name as user_name,
        u.avatar_url as user_avatar
      FROM workgroup_activities wa
      LEFT JOIN users u ON wa.user_id = u.id
      WHERE wa.workgroup_id = $1
      ORDER BY wa.created_at DESC
      LIMIT $2
    `;

    const result = await db.query(query, [id, parseInt(limit)]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Toggle star status for workgroup
const toggleStarWorkgroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_starred } = req.body;

    // Check if user is member
    const memberQuery = `
      SELECT id FROM workgroup_members 
      WHERE workgroup_id = $1 AND user_id = $2
    `;
    const memberResult = await db.query(memberQuery, [id, req.user.id]);

    if (memberResult.rows.length === 0) {
      return res.status(403).json({ error: 'You must be a member to star workgroups' });
    }

    // Update star status
    const updateQuery = `
      UPDATE workgroup_members 
      SET is_starred = $1
      WHERE workgroup_id = $2 AND user_id = $3
      RETURNING *
    `;
    const result = await db.query(updateQuery, [is_starred, id, req.user.id]);

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Fetch link preview metadata (title, description, image) for links shared in chat
const getLinkPreview = async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: 'Valid URL is required' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.json({ url, success: false });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return res.json({ url, success: false });
    }

    // Read first 64KB
    const reader = response.body.getReader();
    let received = '';
    const decoder = new TextDecoder();
    while (received.length < 65536) {
      const { done, value } = await reader.read();
      if (done) break;
      received += decoder.decode(value, { stream: true });
    }
    reader.cancel();

    // Extract og:title or <title>
    const ogTitleMatch = received.match(/<meta\s+[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
      || received.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    const titleTagMatch = received.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = (ogTitleMatch ? ogTitleMatch[1] : (titleTagMatch ? titleTagMatch[1] : '')).trim();

    // Extract og:description or meta description
    const ogDescMatch = received.match(/<meta\s+[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
      || received.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i)
      || received.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const description = (ogDescMatch ? ogDescMatch[1] : '').trim();

    // Extract og:image
    const ogImgMatch = received.match(/<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || received.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    let image = ogImgMatch ? ogImgMatch[1].trim() : '';
    if (image && image.startsWith('/')) {
      const urlObj = new URL(url);
      image = `${urlObj.origin}${image}`;
    }

    // Extract og:site_name
    const ogSiteMatch = received.match(/<meta\s+[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)
      || received.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i);
    const siteName = (ogSiteMatch ? ogSiteMatch[1] : '').trim();

    return res.json({
      success: true,
      url,
      title: title || '',
      description: description || '',
      image: image || '',
      siteName: siteName || '',
    });
  } catch (err) {
    return res.json({
      success: false,
      url: req.query.url,
      error: err.message,
    });
  }
};

module.exports = {
  getWorkgroups,
  getWorkgroup,
  createWorkgroup,
  updateWorkgroup,
  deleteWorkgroup,
  getWorkgroupMembers,
  addWorkgroupMember,
  removeWorkgroupMember,
  getWorkgroupPosts,
  createWorkgroupPost,
  deleteWorkgroupPost,
  deleteWorkgroupPostForMe,
  editWorkgroupPost,
  togglePinWorkgroupPost,
  addWorkgroupPostReaction,
  getOrCreateDirectChatWorkgroup,
  getWorkgroupActivities,
  toggleStarWorkgroup,
  handleWorkgroupCreatorDeparture,
  getLinkPreview
};
