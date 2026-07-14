import crypto from 'crypto';

export function verifyJiraSignature(req, res, next) {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Security Gate] NODE_ENV is set to development. Skipping signature verification.');
    return next();
  }

  const signature = req.headers['x-hub-signature'];
  if (!signature) {
    console.error('[Security Warning] Dropping request: Missing x-hub-signature header.');
    return res.status(401).send('Unauthorized');
  }

  const computedHash =
    'sha256=' +
    crypto
      .createHmac('sha256', process.env.JIRA_WEBHOOK_SECRET || 'SECRET_KEY_NOT_SET')
      .update(req.rawBody)
      .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedHash))) {
    console.error('[Security Warning] Dropping request: Signature hash mismatch.');
    return res.status(403).send('Forbidden');
  }

  next();
}
