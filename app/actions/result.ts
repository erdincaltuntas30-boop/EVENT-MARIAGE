/** Résultat renvoyé par les Server Actions. `code` est une clé de traduction `actions.*`. */
export type ActionResult = { ok: true; code: string; data?: Record<string, unknown> } | { ok: false; code: string; message?: string }

export const ok = (code: string, data?: Record<string, unknown>): ActionResult => ({ ok: true, code, data })
export const fail = (code: string, message?: string): ActionResult => ({ ok: false, code, message })
