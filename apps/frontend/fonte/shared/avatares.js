const TOTAL_AVATARES_ILUSTRADOS = 40;

export const AVATARES_ILUSTRADOS = Array.from({ length: TOTAL_AVATARES_ILUSTRADOS }, (_, indice) => {
  const numero = String(indice + 1).padStart(2, '0');
  return {
    id: `avatar-${numero}`,
    url: `/estilos/avatares/avatar-${numero}.png`,
  };
});

const MAPA_AVATARES_POR_ID = new Map(AVATARES_ILUSTRADOS.map((avatar) => [avatar.id, avatar.url]));

export function resolverAvatarUrl(avatarIlustrado) {
  return MAPA_AVATARES_POR_ID.get(avatarIlustrado) || '';
}
