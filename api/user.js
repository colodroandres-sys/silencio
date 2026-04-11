const { verifyAuth } = require('./_auth');
const { getOrCreateUser, checkUsageLimit } = require('./_limits');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();

  const clerkId = await verifyAuth(req, res);
  if (!clerkId) return;

  const email = req.headers['x-user-email'] || '';
  const user = await getOrCreateUser(clerkId, email);
  const { allowed, usage, limit } = await checkUsageLimit(clerkId);

  res.json({
    plan: user.plan || 'free',
    usage: usage ?? 0,
    limit: limit ?? 1,
    canGenerate: allowed
  });
};
