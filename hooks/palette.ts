// dusk-glass 1.0.0 - the colours: lavender dusk in light mode, an aurora night in dark mode.
// makeColors builds the whole theme from these anchors and reports any surface the app would not paint.
import { makeColors } from './make-colors.js'

export const DUSK = makeColors({
  label: 'Dusk Glass',
  id: 'dusk-glass',
  roles: { accent: '#7454d0', danger: '#c23b4a', success: '#2f8a5e', warning: '#b0741a', pro: '#b8488a' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#ebe5f5',
        'surface-1': '#efe8f8',
        'surface-2': '#f8f6fc',
        'text-primary': '#211c31',
        'text-secondary': '#463f5e',
        'text-muted': '#5d5576',
      },
    },
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#121124',
        'surface-1': '#18162e',
        'surface-2': '#1e1c37',
        'surface-3': '#242140',
        'text-primary': '#eeebff',
        'text-secondary': '#cac4e8',
        'text-muted': '#a59ec7',
      },
    },
  },
})
