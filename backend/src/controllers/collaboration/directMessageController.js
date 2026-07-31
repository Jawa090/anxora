const db = require('../../config/database');
const realtimeService = require('../../services/realtimeService');

const getDirectMessages = async (req, res, next) => {
  try {
    const { contact_user_id } = req.params;
    const { orgId, id: userId } = req.user;
    
    // Fetch direct messages between current user and the target user
    const query = `
      SELECT * FROM direct_messages
      WHERE org_id = $1 AND (
        (sender_id = $2 AND receiver_id = $3) OR (sender_id = $3 AND receiver_id = $2)
      ) AND is_deleted = false
      ORDER BY created_at ASC
    `;
    
    const { rows } = await db.query(query, [orgId, userId, contact_user_id]);
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

const sendDirectMessage = async (req, res, next) => {
  try {
    const { receiver_id, content, parent_id, files, mentions } = req.body;
    const { orgId, id: senderId } = req.user;

    const attachments = Array.isArray(files) ? files : [];
    const messageMentions = Array.isArray(mentions) ? mentions : [];

    const query = `
      INSERT INTO direct_messages (org_id, sender_id, receiver_id, content, parent_id, attachments, mentions)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::uuid[])
      RETURNING *
    `;

    const { rows } = await db.query(query, [
      orgId, senderId, receiver_id, content, parent_id || null, 
      JSON.stringify(attachments), messageMentions
    ]);

    const newMessage = rows[0];

    // Read status initially null, we could add marking as read later

    // Emit Real-time events
    realtimeService.emitDirectMessage(receiver_id, newMessage);

    // If there are mentions, emit mention notifications
    for (const mentioned_user_id of messageMentions) {
       realtimeService.emitMention(mentioned_user_id, {
         type: 'direct_msg',
         message: newMessage
       });
    }

    res.status(201).json(newMessage);
  } catch (error) {
    next(error);
  }
};

const addReaction = async (req, res, next) => {
    try {
        const { messageId } = req.params;
        const { reaction } = req.body;
        const { id: userId, orgId } = req.user;

        // Ensure reaction exists or update jsonb
        const query = `
          UPDATE direct_messages 
          SET reactions = jsonb_set(
            COALESCE(reactions, '{}'::jsonb),
            array[$2],
            to_jsonb(
              array_append(
                ARRAY(SELECT jsonb_array_elements_text(COALESCE(reactions->$2, '[]'::jsonb))), 
                $3
              )
            )
          )
          WHERE id = $1 AND org_id = $4
          RETURNING *
        `;

        // Simplified approach for array tracking is complex in JSONB, 
        // Let's do a fetch then update for Simplicity or just emit the event
        const fetchQ = `SELECT * FROM direct_messages WHERE id = $1 AND org_id = $2`;
        const { rows } = await db.query(fetchQ, [messageId, orgId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Message not found' });
        
        const msg = rows[0];
        const currentReactions = msg.reactions || {};
        if (!currentReactions[reaction]) currentReactions[reaction] = [];
        if (!currentReactions[reaction].includes(userId)) {
             currentReactions[reaction].push(userId);
        } else {
             // Remove reaction
             currentReactions[reaction] = currentReactions[reaction].filter(id => id !== userId);
             if (currentReactions[reaction].length === 0) delete currentReactions[reaction];
        }

        const updateQ = `UPDATE direct_messages SET reactions = $1 WHERE id = $2 RETURNING *`;
        const updatedRows = await db.query(updateQ, [JSON.stringify(currentReactions), messageId]);
        
        // Notify both parties
        const finalMsg = updatedRows.rows[0];
        const roomName = `user:${finalMsg.sender_id === userId ? finalMsg.receiver_id : finalMsg.sender_id}`;
        realtimeService.emitReactionAdded(roomName, { messageId, reactions: currentReactions });

        res.json(finalMsg);
    } catch(err) {
        next(err);
    }
}

module.exports = {
  getDirectMessages,
  sendDirectMessage,
  addReaction
};
