const CODES = {
  // Emergenze
  '7500': { label: 'Dirottamento',       color: '#ff453a', icon: '⚠️' },
  '7600': { label: 'Radio guasta',        color: '#ff9f0a', icon: '📡' },
  '7700': { label: 'Emergenza',           color: '#ff453a', icon: '🆘' },
  '7777': { label: 'Intercettazione mil.', color: '#ff9f0a', icon: '✈' },

  // VFR standard
  '1200': { label: 'VFR (USA)',           color: '#30d158', icon: null },
  '7000': { label: 'VFR (Europa)',        color: '#30d158', icon: null },

  // Transizioni ATC
  '2000': { label: 'Ingresso spazio controllato', color: '#64d2ff', icon: null },
  '2200': { label: 'Contatto ATC perso',  color: '#ff9f0a', icon: null },

  // Militari / speciali
  '0000': { label: 'Non assegnato',       color: '#8e8e93', icon: null },
  '0010': { label: 'Volo militare',       color: '#64d2ff', icon: null },
  '0020': { label: 'Volo militare',       color: '#64d2ff', icon: null },
}

export function squawkInfo(code) {
  if (!code) return null
  return CODES[code] ?? null
}
