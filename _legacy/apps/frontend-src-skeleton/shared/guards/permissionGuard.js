export function hasPermission(session, permission) {
  if (!permission) return true;
  return Array.isArray(session?.permissoes) && session.permissoes.includes(permission);
}
