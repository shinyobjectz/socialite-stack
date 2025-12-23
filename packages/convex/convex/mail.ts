import { action } from './_generated/server';
import { v } from 'convex/values';

/**
 * Mail Service Migration (Phase D)
 *
 * This file implements the mailer in Convex, replacing the NestJS Mailer.
 * It uses external APIs (like Resend or Postmark) to send emails.
 */

export const sendEmail = action({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    text: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not set, skipping email send.');
      return { success: false, message: 'API key not configured' };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Socialite <noreply@socialite.ai>',
          to: [args.to],
          subject: args.subject,
          html: args.html,
          text: args.text,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Resend API error: ${error}`);
      }

      const data = await response.json();
      return { success: true, id: data.id };
    } catch (error) {
      console.error('Failed to send email:', error);
      return { success: false, error: (error as Error).message };
    }
  },
});
