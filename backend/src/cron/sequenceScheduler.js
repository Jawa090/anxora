const db = require('../config/database');
const emailService = require('../services/emailService');

let schemaInitialized = false;

async function initializeSchema() {
  if (schemaInitialized) return;
  try {
    await db.query(`
      ALTER TABLE marketing_sequence_enrollments 
      ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0,
      ADD COLUMN IF NOT EXISTS next_retry_at timestamp without time zone;
    `);
    schemaInitialized = true;
  } catch (e) {
    console.error('[Sequence Scheduler] Schema initialization failed:', e.message);
  }
}

async function processActiveSequences() {
  try {
    // Ensure database columns exist
    await initializeSchema();

    // 1. Fetch active enrollments that are not currently backed off for retry
    const result = await db.query(
      `SELECT se.*, s.steps, s.name as sequence_name, c.email, c.first_name, c.last_name
       FROM marketing_sequence_enrollments se
       JOIN marketing_sequences s ON se.sequence_id = s.id
       JOIN contacts c ON se.contact_id = c.id
       WHERE se.status = 'active' 
         AND s.is_active = true
         AND (se.next_retry_at IS NULL OR se.next_retry_at <= NOW())`
    );

    console.log(`[Sequence Scheduler] Found active enrollments to process: ${result.rows.length}`);

    if (result.rows.length === 0) {
      return;
    }

    for (const enrollment of result.rows) {
      let steps = [];
      try {
        steps = typeof enrollment.steps === 'string' ? JSON.parse(enrollment.steps) : (enrollment.steps || []);
      } catch (e) {
        console.error(`[Sequence Scheduler] Failed to parse steps for sequence ${enrollment.sequence_name}:`, e.message);
        continue;
      }

      console.log(`[Sequence Scheduler] Processing enrollment ${enrollment.id} for sequence "${enrollment.sequence_name}". Current step: ${enrollment.current_step}/${steps.length}`);

      const contact = {
        email: enrollment.email,
        first_name: enrollment.first_name,
        last_name: enrollment.last_name
      };

      // Loop to run immediate steps sequentially until we hit a wait step
      while (true) {
        if (enrollment.current_step >= steps.length) {
          // Sequence completed
          await db.query(
            `UPDATE marketing_sequence_enrollments 
             SET status = 'completed', completed_at = NOW(), updated_at = NOW() 
             WHERE id = $1`,
            [enrollment.id]
          );
          console.log(`[Sequence Scheduler] Completed sequence "${enrollment.sequence_name}" for contact ${contact.email}`);
          break;
        }

        const step = steps[enrollment.current_step];

        if (step.type === 'wait' || step.type === 'delay') {
          const delayValue = parseInt(step.delay_value || step.delay_days || 0);
          const delayUnit = step.delay_unit || 'days';
          
          let waitMs = 0;
          if (delayUnit === 'minutes') waitMs = delayValue * 60 * 1000;
          else if (delayUnit === 'hours') waitMs = delayValue * 60 * 60 * 1000;
          else waitMs = delayValue * 24 * 60 * 60 * 1000; // days

          const elapsedMs = Date.now() - new Date(enrollment.updated_at).getTime();
          if (elapsedMs < waitMs) {
            // Wait period is active, break loop to process next contact
            break;
          }

          // Wait period expired, proceed to next step
          enrollment.current_step += 1;
          const updateRes = await db.query(
            `UPDATE marketing_sequence_enrollments 
             SET current_step = $1, updated_at = NOW() 
             WHERE id = $2 RETURNING updated_at`,
            [enrollment.current_step, enrollment.id]
          );
          enrollment.updated_at = updateRes.rows[0].updated_at;
          console.log(`[Sequence Scheduler] Wait step expired for contact ${contact.email}. Moving to step ${enrollment.current_step}`);
        } else if (step.type === 'email') {
          try {
            const subject = step.email_subject || 'Notification';
            let content = step.email_content || '';

            // Replace template placeholders
            content = content.replace(/\{\{first_name\}\}/g, contact.first_name || '');
            content = content.replace(/\{\{last_name\}\}/g, contact.last_name || '');
            content = content.replace(/\{\{email\}\}/g, contact.email || '');

            console.log(`[Sequence Scheduler] Sending email "${subject}" to ${contact.email} (step ${enrollment.current_step + 1}/${steps.length})`);
            const fromName = step.from_name || process.env.DEFAULT_FROM_NAME || 'Rush CRM';
            const fromEmail = step.from_email || process.env.SMTP_USER;

            await emailService.sendEmail({
              from: `"${fromName}" <${fromEmail}>`,
              to: contact.email,
              subject: subject,
              html: content
            });

            // Email sent successfully: Reset retry state
            await db.query(
              `UPDATE marketing_sequence_enrollments 
               SET retry_count = 0, next_retry_at = NULL 
               WHERE id = $1`,
              [enrollment.id]
            );
          } catch (sendError) {
            console.error(`[Sequence Scheduler] Send failed to ${contact.email}:`, sendError.message);
            
            // Handle retry queue logic
            const retryCount = (enrollment.retry_count || 0) + 1;
            let nextRetryAt = null;
            let status = 'active';

            if (retryCount >= 3) {
              status = 'failed';
              console.error(`[Sequence Scheduler] Enrollment ${enrollment.id} marked as FAILED after 3 attempts.`);
            } else {
              // Retry in 30 minutes, 60 minutes...
              const backoffMinutes = retryCount * 30;
              nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
              console.log(`[Sequence Scheduler] Scheduled retry #${retryCount} for enrollment ${enrollment.id} at ${nextRetryAt}`);
            }

            await db.query(
              `UPDATE marketing_sequence_enrollments 
               SET retry_count = $1, next_retry_at = $2, status = $3, updated_at = NOW() 
               WHERE id = $4`,
              [retryCount, nextRetryAt, status, enrollment.id]
            );
            break; // Stop running further steps for this contact in this loop
          }

          // Move to next step
          enrollment.current_step += 1;
          const updateRes = await db.query(
            `UPDATE marketing_sequence_enrollments 
             SET current_step = $1, updated_at = NOW() 
             WHERE id = $2 RETURNING updated_at`,
            [enrollment.current_step, enrollment.id]
          );
          enrollment.updated_at = updateRes.rows[0].updated_at;
        } else {
          // Skip unsupported step types
          enrollment.current_step += 1;
          const updateRes = await db.query(
            `UPDATE marketing_sequence_enrollments 
             SET current_step = $1, updated_at = NOW() 
             WHERE id = $2 RETURNING updated_at`,
            [enrollment.current_step, enrollment.id]
          );
          enrollment.updated_at = updateRes.rows[0].updated_at;
        }
      }
    }
  } catch (err) {
    console.error(`[Sequence Scheduler] Error running scheduler:`, err.message);
  }
}

module.exports = { processActiveSequences };
