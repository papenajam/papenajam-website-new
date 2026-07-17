// Authentication handler (Task 7: PostgreSQL/Prisma implementation).
//
// This is the FIRST handler migrated to Prisma. Behaviour is byte-identical
// to the established API contract:
//   - POST /auth/login  -> finds user by lowercased email, bcrypt-compares the
//     password, issues a JWT (lib/auth.js is DB-independent and is reused
//     unchanged). 401 `{ error: 'Email atau password salah' }` on miss/bad pw.
//   - GET  /auth/verify -> returns `{ user }` from requireAuth(request) or 401.
//
// Mapping (plan lines 561-562):
//   - `users.findOne({ email: email.toLowerCase() })` ->
//     `prisma.user.findUnique({ where: { email: email.toLowerCase() } })`.
//     Email uniqueness is enforced by `email String @unique` in the schema.
//   - The password hash is fetched from the row (NOT selected out) because
//     bcrypt.compare needs it; it is never put on the wire (the response is
//     built explicitly from `{ id, name, email, role }`).
//   - bcrypt.compare + JWT payload/expiry come straight from lib/auth.js.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken, comparePassword, requireAuth } from '@/lib/auth';

export async function handleAuth(request, segments, method) {
  const [sub] = segments;

  if (sub === 'login' && method === 'POST') {
    const { email, password } = await request.json();
    const user = await prisma.user.findUnique({
      where: { email: (email || '').toLowerCase() },
    });
    if (!user) return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
    const valid = await comparePassword(password, user.password);
    if (!valid) return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
    const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role || 'admin' });
    return NextResponse.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role || 'admin' } });
  }

  if (sub === 'verify' && method === 'GET') {
    const user = requireAuth(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ user });
  }

  return null;
}
