/**
 * Caminho canônico do cliente HTTP. O adapter executável atual está em
 * Front/fonte/services/api/core.js até a conclusão da migração sem build.
 */
export const API_ERROR_EVENT = 'conecta-api-error';

export function notifyApiError(error) {
  window.dispatchEvent(new CustomEvent(API_ERROR_EVENT, { detail: error }));
}
