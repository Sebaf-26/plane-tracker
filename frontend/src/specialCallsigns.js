// Callsign italiani speciali — prefissi radio ufficiali
// icon: 'fire' | 'shield' | 'anchor' | 'helicopter' | 'airplane' | 'star' | 'cross'

export const SPECIAL_CALLSIGNS = [
  // Guardia di Finanza
  { prefix: 'VOLPE', label: 'Guardia di Finanza', icon: 'fire',    color: '#ff9f0a' },
  { prefix: 'VOLP',  label: 'Guardia di Finanza', icon: 'fire',    color: '#ff9f0a' },

  // Polizia di Stato
  { prefix: 'POLI',  label: 'Polizia di Stato',   icon: 'shield',  color: '#0a84ff' },
  { prefix: 'POLIS', label: 'Polizia di Stato',   icon: 'shield',  color: '#0a84ff' },

  // Carabinieri — CC seguito da cifra (es. CC4051); CCM = Air Corsica → escluso
  { prefix: 'FIAMMA',label: 'Carabinieri',         icon: 'shield',  color: '#cc0000' },
  { prefix: 'FIAA',  label: 'Carabinieri',         icon: 'shield',  color: '#cc0000' },
  { prefix: 'CC',    label: 'Carabinieri',         icon: 'shield',  color: '#cc0000', digitRequired: true },

  // Vigili del Fuoco — VF seguito da cifra (es. VF001); VFR ecc. → esclusi
  { prefix: 'DRAGO', label: 'Vigili del Fuoco',    icon: 'fire',    color: '#ff3b30' },
  { prefix: 'DRG',   label: 'Vigili del Fuoco',    icon: 'fire',    color: '#ff3b30' },
  { prefix: 'VF',    label: 'Vigili del Fuoco',    icon: 'fire',    color: '#ff3b30', digitRequired: true },
  { prefix: 'VVF',   label: 'Vigili del Fuoco',    icon: 'fire',    color: '#ff3b30' },

  // Guardia Costiera — CP seguito da cifra (es. CP905); CPA = Cathay Pacific → escluso
  { prefix: 'KOALA', label: 'Guardia Costiera',    icon: 'anchor',  color: '#30d158' },
  { prefix: 'KLA',   label: 'Guardia Costiera',    icon: 'anchor',  color: '#30d158' },
  { prefix: 'CP',    label: 'Guardia Costiera',    icon: 'anchor',  color: '#30d158', digitRequired: true },
  { prefix: 'GABBIA',label: 'Guardia Costiera',    icon: 'anchor',  color: '#30d158' },
  { prefix: 'GABBN', label: 'Guardia Costiera',    icon: 'anchor',  color: '#30d158' },

  // Elisoccorso 118 (tutte le varianti regionali)
  { prefix: 'PEGASO',label: 'Elisoccorso 118',     icon: 'cross',   color: '#ff453a' },
  { prefix: 'PGSO',  label: 'Elisoccorso 118',     icon: 'cross',   color: '#ff453a' },
  { prefix: 'PELIKA',label: 'Elisoccorso 118',     icon: 'cross',   color: '#ff453a' },
  { prefix: 'PELIC', label: 'Elisoccorso 118',     icon: 'cross',   color: '#ff453a' },
  { prefix: 'INSUB', label: 'Elisoccorso 118',     icon: 'cross',   color: '#ff453a' },
  { prefix: 'GRIFO', label: 'Elisoccorso 118',     icon: 'cross',   color: '#ff453a' },
  { prefix: 'NIKO',  label: 'Elisoccorso 118',     icon: 'cross',   color: '#ff453a' },
  { prefix: 'HEMS',  label: 'Elisoccorso 118',     icon: 'cross',   color: '#ff453a' },

  // Aeronautica Militare / SAR
  { prefix: 'ICARO', label: 'AM — SAR',            icon: 'star',    color: '#64d2ff' },
  { prefix: 'RESCUE',label: 'AM — SAR',            icon: 'star',    color: '#64d2ff' },
  { prefix: 'AMI',   label: 'Aeronautica Militare',icon: 'star',    color: '#64d2ff' },

  // Frecce Tricolori / pattuglie acrobatiche
  { prefix: 'PONY',  label: 'Frecce Tricolori',    icon: 'airplane',color: '#30d158' },

  // Marina Militare — MM seguito da cifra (es. MM61951); MMA ecc. → esclusi
  { prefix: 'MARINA',label: 'Marina Militare',     icon: 'anchor',  color: '#5ac8fa' },
  { prefix: 'MM',    label: 'Marina Militare',     icon: 'anchor',  color: '#5ac8fa', digitRequired: true },
]

export function getSpecial(flight) {
  if (!flight) return null
  const f = flight.trim().toUpperCase()
  return SPECIAL_CALLSIGNS.find(s => {
    if (!f.startsWith(s.prefix)) return false
    // Per i prefissi corti ambigui il carattere successivo deve essere una cifra
    if (s.digitRequired) {
      const nextChar = f[s.prefix.length]
      if (nextChar !== undefined && !/\d/.test(nextChar)) return false
    }
    return true
  }) ?? null
}

// MDI SVG paths
export const MDI = {
  airplane:   'M21,16V14L13,9V3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z',
  helicopter: 'M22,10V9H17V4H16V9H13.74C13.37,8.39 12.74,8 12,8C11.26,8 10.63,8.39 10.26,9H8V4H7V9H2V10H7V11.26C5.21,11.81 4,13.26 4,15V18H20V15C20,13.26 18.79,11.81 17,11.27V10H22M12,10A1,1 0 0,1 13,11A1,1 0 0,1 12,12A1,1 0 0,1 11,11A1,1 0 0,1 12,10M6,16H4.5V15C4.5,14 5.12,13.17 6,12.76V16M12,16H7V12.34C7.31,12.12 7.64,12 8,12H16C16.36,12 16.69,12.12 17,12.34V16H12M19.5,16H18V12.76C18.88,13.17 19.5,14 19.5,15V16Z',
  fire:       'M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2Z',
  shield:     'M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1Z',
  anchor:     'M17,14L18.25,12H21V10H18.25L17,8H14V6.72A2,2 0 0,0 14,3A2,2 0 0,0 12,1A2,2 0 0,0 10,3A2,2 0 0,0 10,6.72V8H7L5.75,10H3V12H5.75L7,14V19L12,21L17,19V14M12,3A1,1 0 0,1 13,4A1,1 0 0,1 12,5A1,1 0 0,1 11,4A1,1 0 0,1 12,3Z',
  star:       'M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z',
  cross:      'M19,3H15V1H9V3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M11,17H9V13H5V11H9V7H11V11H15V13H11V17M15,9H13V7H15V9Z',
}

export function iconPath(special, isHeli) {
  if (!special) return isHeli ? MDI.helicopter : MDI.airplane
  return MDI[special.icon] ?? MDI.airplane
}
