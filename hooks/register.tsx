// dusk-glass v1.0.0 - a look for the Claude desktop app: lavender-dusk colours on every
// surface, and a living dusk sky behind the conversation: drifting light, fireflies that
// glow up one or two at a time, a small pen-drawn bee, and three flowers growing up out of
// the window's bottom-right corner. Optionally, the conversation's words in Comic Sans
// (the `font` option): the theme's own `style`, which keeps the words the app's real text.
//
// The sky is ONE Svg: the app's backdrop player plays a backdrop only when the tree is a
// single Svg, and stills one that costs more than about 5.6 ms a frame to draw.
import type { Register, ThemeSetArgs } from 'claude-code'

import { DUSK } from './palette'
import { SCENE } from './scene'
import { FLOWERS, FLOWERS_W, FLOWERS_H } from './flowers'

const PLUGIN = 'dusk-glass'

// Where the flowers stand, in CSS px from the window's bottom-right corner.
const RIGHT_INSET = 36 // the drawing's right edge, this far in from the window's right edge
const SINK = -12 // the stem bases, 12 px above the window's bottom edge (each stem's 24 px root still runs out of it)

const FLOWER_BODY = FLOWERS.slice(FLOWERS.indexOf('>') + 1, FLOWERS.lastIndexOf('</svg>'))

// The flowers as their own drawing over the sky, pinned to the bottom-right corner at any
// window size: an inner frame placed at (100%, 100%), the flowers drawn up and left of it.
const FLOWERS_CORNER =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">' +
  `<svg x="100%" y="100%" overflow="visible"><g transform="translate(${-RIGHT_INSET - FLOWERS_W} ${SINK - FLOWERS_H})">` +
  `${FLOWER_BODY}</g></svg></svg>`

// The one drawing the app plays: the sky, then the corner flowers over it, inside one outer frame.
const OPEN = '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">'
const MERGED = FLOWERS_CORNER.startsWith(OPEN) ? OPEN + SCENE + FLOWERS_CORNER.slice(OPEN.length) : SCENE

const SOURCE_MAX = 131072 // the app refuses a longer Svg source and draws nothing

const LOOK: ThemeSetArgs = {
  colors: DUSK.theme,
  backdrop: { scene: 'dusk', glass: { blur: 0, opacity: 0 } },
}

// Comic Sans through the generic `cursive` family: on Windows, Chromium (and so the
// desktop app) draws `cursive` as Comic Sans MS. Other systems show their own cursive font.
// Typed loosely: an older engine's types have no `style`, and its theme.set throws on one
// (caught below), so the mod type-checks and runs on both.
const COMIC = {
  Text: { fontFamily: ['cursive'] },
  Heading: { fontFamily: ['cursive'] },
  ToolUse: { fontFamily: ['cursive'] },
} as const

export const register: Register = (on, options) => {
  const comic = options.font !== 'app-default'

  on('session.start', async ($, e, next) => {
    const unpainted = DUSK.problems.find(line => line.startsWith("Desktop won't paint"))
    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    if (comic) {
      try {
        const styled = { ...LOOK, style: COMIC }
        await $.theme.set(styled)
      } catch (error) {
        // a build that doesn't take `style` throws and sets nothing: keep the colours and the sky
        $.ui.log(String(error))
        await $.theme.set(LOOK)
      }
    } else {
      await $.theme.set(LOOK)
    }
    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.props.plugin !== PLUGIN || (e.surface !== 'desktop' && e.surface !== 'mobile')) {
      return next(e)
    }
    const { Box, Svg } = $.ui.resolve(e)
    const whole = MERGED.length <= SOURCE_MAX
    return (
      <Box>
        <Svg
          source={whole ? MERGED : SCENE}
          alt={
            'A dusk sky with drifting light, fireflies that glow up one or two at a time and fade as they wander, and a tiny pen-drawn bee wandering the whole screen leaving a fading dotted trail' +
            (whole ? '; three pen-drawn flowers grow up out of the bottom-right corner of the window, bending in a passing breeze now and then' : '')
          }
          isInteractive
        />
      </Box>
    )
  })
}
