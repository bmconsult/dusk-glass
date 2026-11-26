# Changelog

## 1.0.0 (2026-11-26)

First public release.

- Lavender-dusk colours for light mode and an aurora-night palette for dark mode.
- A living dusk sky behind the conversation: five drifting pools of light, six fireflies that
  glow up one or two at a time, a pen-drawn bee with a fading dotted trail, and three flowers
  growing out of the window's bottom-right corner that bend in a passing breeze.
- Optional Comic Sans for the conversation (`font` option, on by default), through the theme's
  own `style`, so the words stay real, selectable text.
- Sky and flowers kept to one SVG under the app's size limit and light enough for its
  backdrop player's per-frame cost check.
- Generators for the sky and flowers in `tools/`, each with self-checks that include fixtures
  built to fail.
