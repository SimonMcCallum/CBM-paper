/**
 * LTI 1.3 Setup using ltijs.
 *
 * Handles platform registration, OIDC launch, deep linking (mode selection),
 * and grade passback (AGS).
 */

import path from 'path';

// ltijs is CommonJS — import as namespace
const lti = require('ltijs').default;

const LTI_KEY = process.env.LTI_KEY || 'cbm-lti-plugin-key';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cbm-lti';
const EXTERNAL_URL = process.env.EXTERNAL_URL || 'http://localhost:3000';

export async function setupLTI(app: any): Promise<typeof lti> {
  // Initialize ltijs
  lti.setup(
    LTI_KEY,
    { url: MONGODB_URI },
    {
      appUrl: '/',
      loginUrl: '/login',
      keysetUrl: '/keys',
      dynRegRoute: '/register',
      staticPath: path.join(__dirname, '../../public'),
      cookies: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
      },
    }
  );

  // ── LTI Launch Handler ──
  // Routes student to quiz runner or submission validator based on assignment config

  lti.onConnect(async (token: any, req: any, res: any) => {
    try {
      const context = token.platformContext;
      const userId = token.user;
      const courseId = context?.context?.id || 'unknown';
      const assignmentId = context?.resource?.id || context?.custom?.assignment_id || '';
      const roles = context?.roles || [];
      const isInstructor = roles.some((r: string) =>
        r.includes('Instructor') || r.includes('Administrator')
      );

      // Store token data for later grade passback
      const tokenData = {
        userId,
        courseId,
        assignmentId,
        roles,
        name: token.userInfo?.name || 'Student',
        email: token.userInfo?.email,
        lineItem: context?.endpoint?.lineitem,
        platformId: token.iss,
      };

      // Check if this assignment has a config
      // Pass to Express routes via query params (ltijs serves static files)
      const params = new URLSearchParams({
        user_id: userId,
        course_id: courseId,
        assignment_id: assignmentId,
        name: tokenData.name,
        is_instructor: isInstructor ? '1' : '0',
        token: Buffer.from(JSON.stringify(tokenData)).toString('base64'),
      });

      // Route based on tool mode (will be determined by assignment_config lookup)
      if (isInstructor && !assignmentId) {
        // Instructor launching without assignment context → show config page
        return res.redirect(`/admin/setup?${params}`);
      }

      // Default: route to the assessment launcher which checks config
      return res.redirect(`/launch?${params}`);
    } catch (err) {
      console.error('LTI launch error:', err);
      return res.status(500).send('Launch error');
    }
  });

  // ── Deep Linking Handler ──
  // Instructor selects quiz runner or submission validator and configures it

  lti.onDeepLinking(async (token: any, req: any, res: any) => {
    const context = token.platformContext;
    const courseId = context?.context?.id || '';

    const params = new URLSearchParams({
      course_id: courseId,
      token: Buffer.from(JSON.stringify({
        userId: token.user,
        courseId,
        platformId: token.iss,
      })).toString('base64'),
    });

    return res.redirect(`/admin/deeplink?${params}`);
  });

  // Attach ltijs to the Express app
  await lti.deploy({ serverless: true });

  // Mount ltijs as middleware
  app.use(lti.app);

  return lti;
}

/**
 * Submit a grade back to Canvas via LTI AGS.
 */
export async function submitGrade(
  tokenData: any,
  scoreGiven: number,
  scoreMaximum: number,
  comment?: string
): Promise<boolean> {
  const lti = require('ltijs').default;

  try {
    const grade = {
      scoreGiven,
      scoreMaximum,
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
      comment: comment || '',
    };

    // Use the stored line item URL
    if (tokenData.lineItem) {
      await lti.Grade.submitScore(
        { iss: tokenData.platformId, user: tokenData.userId },
        grade,
        { resourceLinkId: tokenData.assignmentId }
      );
      return true;
    }

    console.warn('No line item URL available for grade passback');
    return false;
  } catch (err) {
    console.error('Grade passback error:', err);
    return false;
  }
}
