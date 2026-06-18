// Soglia in secondi tra due punti per considerarli sessioni diverse
export const GAP_S = 600

// Normalizza ts: se in millisecondi (Date.now()) converte in secondi
function normTs(ts) {
  return ts > 1e10 ? ts / 1000 : ts
}

export const SESSION_COLORS = ['#fac123', '#64d2ff', '#ff453a', '#30d158', '#bf5af2', '#ff9f0a']

// Divide un array di punti {ts, ...} in sessioni separate
export function splitSessions(points) {
  if (!points || points.length === 0) return []
  const sessions = []
  let current = [points[0]]
  for (let i = 1; i < points.length; i++) {
    if (normTs(points[i].ts) - normTs(points[i - 1].ts) > GAP_S) {
      sessions.push(current)
      current = []
    }
    current.push(points[i])
  }
  sessions.push(current)
  return sessions
}
