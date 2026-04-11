const { verifyToken } = require('@clerk/backend');

/**
 * Verifica el JWT de Clerk enviado en el header Authorization.
 * Retorna el clerk_id si es válido, o null si ya respondió con 401.
 */
async function verifyAuth(req, res) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!token) {
    res.status(401).json({ error: 'No autenticado. Inicia sesión para continuar.' });
    return null;
  }

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    return payload.sub; // clerk user ID
  } catch (e) {
    console.error('[auth] Token inválido:', e.message);
    res.status(401).json({ error: 'Sesión expirada. Vuelve a iniciar sesión.' });
    return null;
  }
}

module.exports = { verifyAuth };
