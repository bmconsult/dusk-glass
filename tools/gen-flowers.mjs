// gen-flowers.mjs - dusk-glass: a few pen-drawn flowers growing out of the top of the
// prompt box, still most of the time, bent by a passing breeze now and then.
// Usage: node tools/gen-flowers.mjs hooks/flowers.ts [out.svg]   (env FIXTURE=stiff|busy builds a
// version that MUST fail the checks, to prove they bite)
//
// SPEC (written before building; the generator throws if a check fails):
//  S1 three flowers, every stem base on the drawing's bottom edge (they grow out of the box)
//  S2 pen lines only: every drawn element is a stroke with fill none; no gradients or filters
//  S3 a gust makes each flower lean 7-18 deg, then swing back past upright at least twice
//     with decaying swings (>1 deg), like a real stem
//  S4 "once in a while": a flower is visibly moving (|lean| > 1 deg) 15-40% of the loop,
//     and gusts start >= 10 s apart (no constant waving)
//  S5 the gust TRAVELS: each gust starts moving the flowers left to right, >= 30 ms apart
//  S6 heads lag their stems (secondary swing), peak 2-8 deg
//  S7 nothing leaves the drawing: every sampled stem and head point stays >= 2 px inside
//  S8 the loop closes: lean and head angle < .05 deg at both ends
//  S9 the stored keys rebuild the motion within .2 deg (< .2 px at the tallest tip); the file is under FLOWERS_MAX
//     (40000: it shares the app's 131072-char backdrop limit with the scene's 90000) and
//     parses as strict XML (checked by the caller)
import { writeFileSync } from 'node:fs'

const VERSION = '1.0.0'
// v0.17: each stem has a ROOT running ROOT px straight on below its base, inside the base segment's
// own group, so it leans with the stem. register.tsx now stands the bases ABOVE the window's bottom
// edge (the leaves sat on the edge and were cut off); the root is what still grows out of the edge.
const ROOT = 24
const FLOWERS_MAX = 40000
// key tolerances: per stem segment (a third of the lean; three segments add up to <= .18 deg) and per head
const TOL_TH = 0.06, TOL_PH = 0.15
const FIXTURE = process.env.FIXTURE ?? ''
const W = 150, H = 72, LOOP = 53, FPS = 30

let seed = 20261119
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
const f2 = v => (Math.abs(v) < 0.005 ? 0 : +v.toFixed(2))

// ---------------------------------------------------------------- the flowers
const FLOWERS = [
  { x: 48, len: 47, R: 10.5, n: 6, rest: -7, hz: 1.15, leaf: -1 },
  { x: 72, len: 37, R: 8.5, n: 5, rest: 3, hz: 1.35, leaf: 0 },
  { x: 93, len: 28, R: 6.8, n: 6, rest: 11, hz: 1.6, leaf: 1 },
]

// a scalloped rim: r = r0 + (R - r0) |sin(n phi / 2)|^p, wobbled, drawn a little past
// closed the way a pen overshoots
function rim(R, n, turns, start, wob, a, b) {
  const pts = [], N = Math.round(26 * n * turns)
  for (let i = 0; i <= N; i++) {
    const ph = start + (2 * Math.PI * turns * i) / N
    const r = R * (0.36 + 0.64 * Math.pow(Math.abs(Math.sin((n * ph) / 2)), 0.72))
      * (1 + wob * Math.sin(3 * ph + a) + 0.6 * wob * Math.sin(5 * ph + b))
    pts.push([r * Math.cos(ph), r * Math.sin(ph)])
  }
  return pts
}
function loop(r, turns, start, wob) {
  const pts = [], N = Math.round(40 * turns)
  for (let i = 0; i <= N; i++) {
    const ph = start + (2 * Math.PI * turns * i) / N
    const rr = r * (1 + wob * Math.sin(2 * ph + 1.3)) * (1 - 0.12 * i / N)
    pts.push([rr * Math.cos(ph), rr * Math.sin(ph)])
  }
  return pts
}
const poly = pts => 'M' + pts.map(p => `${f2(p[0])} ${f2(p[1])}`).join('L')

function headSvg(F) {
  const s0 = rnd() * 6.28
  const main = rim(F.R, F.n, 1.06, s0, 0.06, rnd() * 6, rnd() * 6)
  const sketch = rim(F.R * 0.97, F.n, 0.45, s0 + 1.1, 0.08, rnd() * 6, rnd() * 6)
  const eye = loop(F.R * 0.3, 1.2, rnd() * 6.28, 0.08)
  const tips = []
  for (let k = 0; k < F.n; k += 2) {
    const a = s0 + (Math.PI * (2 * k + 1)) / F.n
    tips.push(`M${f2(Math.cos(a) * F.R * 0.42)} ${f2(Math.sin(a) * F.R * 0.42)}L${f2(Math.cos(a) * F.R * 0.62)} ${f2(Math.sin(a) * F.R * 0.62)}`)
  }
  return `<path class="pet" d="${poly(main)}"/><path class="pet sk" d="${poly(sketch)}"/>`
    + `<path class="pet vein" d="${tips.join('')}"/><path class="eye" d="${poly(eye)}"/>`
}

// a stem in three segments (each bends by a third of the lean, so the stem curves)
function segSvg(len, j, side) {
  const c = (j === 1 ? -1 : 1) * side * 1.3
  return `<path class="stem" d="M0 0Q${f2(c)} ${f2(-len / 2)} 0 ${f2(-len)}"/>`
}
function leafSvg(len, side) {
  const y = -len * 0.55, L = len * 0.9 + 4, s = side
  return `<path class="leaf" d="M0 ${f2(y)}C${f2(s * L * 0.3)} ${f2(y - L * 0.45)} ${f2(s * L * 0.85)} ${f2(y - L * 0.35)} ${f2(s * L)} ${f2(y - L * 0.55)}`
    + `C${f2(s * L * 0.75)} ${f2(y - L * 0.05)} ${f2(s * L * 0.3)} ${f2(y + 0.5)} ${f2(s * 0.6)} ${f2(y - 0.6)}`
    + `M${f2(s * 1.5)} ${f2(y - 1.2)}L${f2(s * L * 0.72)} ${f2(y - L * 0.38)}"/>`
}

// ---------------------------------------------------------------- the breeze
const GUSTS = FIXTURE === 'busy'
  ? Array.from({ length: 9 }, (_, i) => ({ t: 1 + i * 5.6, a: 0.9, hold: 1.2 }))
  : [{ t: 3.0, a: 1.0, hold: 1.5 }, { t: 21.5, a: 0.62, hold: 0.9 }, { t: 37.5, a: 0.85, hold: 2.1 }]
// FALL must be shorter than a stem's swing period (0.6-0.9 s): a gust that eases off slowly
// lets the stem follow it home with no rebound (measured: 0 back-swings at FALL 1.4 s)
const RISE = 0.6, FALL = 0.3, WIND = 230 // px/s: how fast a gust crosses the cluster
const ss = u => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))
function gust(t) {
  let g = 0
  for (const G of GUSTS) {
    const u = t - G.t
    if (u < 0 || u > RISE + G.hold + FALL) continue
    const env = ss(u / RISE) * (1 - ss((u - RISE - G.hold) / FALL))
    g += G.a * env * (1 + 0.14 * Math.sin(2 * Math.PI * 3.1 * u))
  }
  return g
}

const DT = 1 / 600, NS = Math.round(LOOP * FPS)
const x0 = Math.min(...FLOWERS.map(F => F.x))
for (const F of FLOWERS) {
  const w = 2 * Math.PI * F.hz, z = FIXTURE === 'stiff' ? 1.2 : 0.14
  const A = 13 * (F.len / 47) ** 0.35 // deg at full gust: taller stems catch more
  const wh = 2 * Math.PI * 2.7, zh = 0.24, kap = FIXTURE === 'stiff' ? 0 : 2.2
  const delay = (F.x - x0) / WIND
  let th = 0, v = 0, ph = 0, vh = 0
  F.th = [], F.ph = [], F.dense = []
  const steps = Math.round(LOOP / DT)
  for (let i = 0; i <= steps; i++) {
    const t = i * DT
    if (i % Math.round(1 / (FPS * DT)) === 0) { F.th.push(th); F.ph.push(ph) }
    if (i % 4 === 0) F.dense.push([t, th, ph])
    const acc = -w * w * th - 2 * z * w * v + w * w * A * gust(t - delay)
    v += acc * DT; th += v * DT
    const acch = -wh * wh * ph - 2 * zh * wh * vh - kap * acc
    vh += acch * DT; ph += vh * DT
  }
  F.th.length = NS + 1; F.ph.length = NS + 1
  F.delay = delay
}

// ---------------------------------------------------------------- keys
// keep only the samples a straight line between kept keys cannot reproduce
function simplify(vals, tol) {
  const keep = new Uint8Array(vals.length); keep[0] = keep[vals.length - 1] = 1
  const stack = [[0, vals.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop(); let worst = -1, wi = -1
    for (let i = a + 1; i < b; i++) {
      const e = Math.abs(vals[i] - (vals[a] + ((vals[b] - vals[a]) * (i - a)) / (b - a)))
      if (e > worst) { worst = e; wi = i }
    }
    if (worst > tol) { keep[wi] = 1; stack.push([a, wi], [wi, b]) }
  }
  return [...keep.keys()].filter(i => keep[i])
}
function anim(vals, scale, tol) {
  const idx = simplify(vals.map(v => v * scale), tol)
  const kt = idx.map(i => +(i / NS).toFixed(5)).join(';')
  const vs = idx.map(i => f2(vals[i] * scale)).join(';')
  return { idx, xml: `<animateTransform attributeName="transform" type="rotate" dur="${LOOP}s" repeatCount="indefinite" calcMode="linear" keyTimes="${kt}" values="${vs}"/>` }
}

// ---------------------------------------------------------------- drawing
let body = ''
const keysUsed = []
for (const [i, F] of FLOWERS.entries()) {
  const side = i % 2 ? -1 : 1, seg = F.len / 3
  const a1 = anim(F.th, 1 / 3, TOL_TH), ah = anim(F.ph, 1, TOL_PH)
  keysUsed.push(a1.idx, ah.idx)
  const idle = `<animateTransform attributeName="transform" type="rotate" dur="${(6.1 + i * 1.7).toFixed(1)}s" repeatCount="indefinite" values="0;.7;0;-.5;0" keyTimes="0;.3;.5;.8;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1;.45 0 .55 1"/>`
  const segs = j => `<g>${a1.xml}${j === 0 ? `<path class="stem" d="M0 0L0 ${ROOT}"/>` : ''}${segSvg(seg, j, side)}${j === 0 && F.leaf ? leafSvg(seg, F.leaf) : ''}`
    + (j < 2 ? `<g transform="translate(0 ${f2(-seg)})">${segs(j + 1)}</g>`
      : `<g transform="translate(0 ${f2(-seg)})"><g>${ah.xml}<g transform="rotate(${-F.rest})">${headSvg(F)}</g></g></g>`)
    + '</g>'
  body += `<g transform="translate(${F.x} ${H}) rotate(${F.rest})"><g>${idle}${segs(0)}</g></g>`
}

const css = [
  '.stem, .leaf, .pet, .eye { fill: none; stroke-linecap: round; stroke-linejoin: round }',
  '.stem { stroke: #5f7d52; stroke-width: 1.25 }',
  '.leaf { stroke: #5f7d52; stroke-width: 1.05 }',
  '.pet { stroke: #e0602f; stroke-width: 1.3 }',
  '.pet.sk { stroke-opacity: .45; stroke-width: 1 }',
  '.pet.vein { stroke-opacity: .6; stroke-width: .9 }',
  '.eye { stroke: #2a2133; stroke-width: 1.1 }',
  '@media (prefers-color-scheme: dark) {',
  '  .stem, .leaf { stroke: #b2d39e } .pet { stroke: #ffa877 } .eye { stroke: #efe8ff }',
  '}',
].join('\n')
for (const ch of '<>&') if (css.includes(ch)) throw new Error('style block holds ' + ch)

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
  + `<!-- dusk-glass flowers v${VERSION}: three pen-drawn flowers; a gust every 16-18 s bends them, left to right -->`
  + `<style>${css}</style>${body}</svg>`

// ---------------------------------------------------------------- checks
const fails = []
const check = (ok, msg) => { if (!ok) fails.push(msg) }
check(FLOWERS.length === 3, 'S1 three flowers')
check(!/fill="(?!none)/.test(svg) && !/Gradient|<filter|<circle|<rect|<ellipse/.test(svg), 'S2 pen lines only')

for (const [i, F] of FLOWERS.entries()) {
  const d = F.dense, abs = d.map(r => Math.abs(r[1]))
  for (const G of GUSTS) {
    const t0 = G.t + F.delay, t1 = t0 + RISE + G.hold + FALL + 5
    const win = d.filter(r => r[0] >= t0 && r[0] <= t1)
    const pk = win.reduce((m, r) => (r[1] > m[1] ? r : m), win[0])
    check(pk[1] >= 7 * G.a ** 0.5 * 0.85 && pk[1] <= 18, `S3 flower ${i} gust ${G.t}: peak ${pk[1].toFixed(1)} deg`)
    // swings after the wind lets go: local extremes beyond 1 deg, alternating sign, decaying
    const after = win.filter(r => r[0] >= t0 + RISE + G.hold + FALL * 0.5)
    const ext = []
    for (let k = 1; k < after.length - 1; k++) {
      const [a, b, c] = [after[k - 1][1], after[k][1], after[k + 1][1]]
      if ((b > a && b >= c) || (b < a && b <= c)) if (Math.abs(b) > 1) ext.push(b)
    }
    const neg = ext.filter(v => v < 0).length
    check(neg >= 2, `S3 flower ${i} gust ${G.t}: ${neg} back-swings past upright (need 2)`)
    F.peakT = F.peakT ?? []; F.peakT.push(pk[0])
    F.onT = F.onT ?? []; F.onT.push((win.find(r => r[1] > 1) ?? [NaN])[0])
  }
  const moving = abs.filter(v => v > 1).length / abs.length
  check(moving >= 0.15 && moving <= 0.4, `S4 flower ${i} moving ${(moving * 100).toFixed(0)}% of the loop`)
  F.moving = moving
  const hp = Math.max(...d.map(r => Math.abs(r[2])))
  check(hp >= 2 && hp <= 8, `S6 flower ${i} head lag peak ${hp.toFixed(1)} deg`)
  F.headPeak = hp
  const e = d[d.length - 1]
  check(Math.abs(d[0][1]) < 0.05 && Math.abs(e[1]) < 0.05 && Math.abs(e[2]) < 0.05, `S8 flower ${i} loop end ${e[1].toFixed(3)}/${e[2].toFixed(3)}`)
}
for (let k = 1; k < GUSTS.length; k++) check(GUSTS[k].t - GUSTS[k - 1].t >= 10, `S4 gusts ${GUSTS[k - 1].t} and ${GUSTS[k].t} too close`)
for (let g = 0; g < GUSTS.length; g++) {
  const order = FLOWERS.map(F => F.onT[g])
  check(order.every((t, i) => i === 0 || t > order[i - 1] + 0.03), `S5 gust ${g} onsets not left to right: ${order.map(t => t.toFixed(2))}`)
}
// S7: the furthest a flower reaches, along the motion actually stored
let minIn = Infinity
for (const [i, F] of FLOWERS.entries()) {
  for (let s = 0; s <= NS; s++) {
    const th = (F.th[s] + F.rest) * Math.PI / 180, idle = 0.7 * Math.PI / 180
    for (const sgn of [-1, 1]) {
      const a = th + sgn * idle
      // stem tip, then head points out to radius R (head counter-rotated by rest, plus lag)
      const tx = F.x + Math.sin(a) * F.len, ty = H - Math.cos(a) * F.len
      for (let k = 0; k < 16; k++) {
        const q = (k / 16) * 2 * Math.PI, R = F.R * 1.12
        const px = tx + Math.cos(q) * R, py = ty + Math.sin(q) * R
        minIn = Math.min(minIn, px, W - px, py)
      }
    }
  }
}
check(minIn >= 2, `S7 a head comes within ${minIn.toFixed(1)} px of the edge`)
// S9 key rebuild against the dense motion
let worst = 0
for (const F of FLOWERS) {
  for (const [name, arr, sc] of [['th', 1, 1], ['ph', 2, 1]]) {
    const vals = name === 'th' ? F.th : F.ph
    const idx = simplify(vals.map(v => (name === 'th' ? v / 3 : v)), name === 'th' ? TOL_TH : TOL_PH)
    for (const r of F.dense) {
      const s = (r[0] * FPS), j = idx.findIndex(x => x >= s)
      if (j <= 0) continue
      const a = idx[j - 1], b = idx[j], va = vals[a] * (name === 'th' ? 1 / 3 : 1), vb = vals[b] * (name === 'th' ? 1 / 3 : 1)
      const v = va + ((vb - va) * (s - a)) / (b - a)
      worst = Math.max(worst, Math.abs(v - r[arr] * (name === 'th' ? 1 / 3 : 1)) * (name === 'th' ? 3 : 1))
    }
  }
}
check(worst <= 0.2, `S9 keys rebuild worst error ${worst.toFixed(3)} deg`)
check(svg.length <= FLOWERS_MAX, `S9 size ${svg.length} > ${FLOWERS_MAX}`)

const report = FLOWERS.map((F, i) => `flower ${i}: moving ${(F.moving * 100).toFixed(0)}%, head lag ${F.headPeak.toFixed(1)} deg, starts moving at ${F.onT.map(t => t.toFixed(2)).join('/')}`)
console.log(report.join('\n'))
console.log(`edge margin ${minIn.toFixed(1)} px, rebuild worst ${worst.toFixed(3)} deg (whole-stem lean), ${svg.length} chars`)
if (fails.length) { console.log('FAIL\n  ' + fails.join('\n  ')); process.exit(1) }
console.log('PASS (S1-S9)')

const [out, outSvg] = process.argv.slice(2)
const ts = `// GENERATED by tools/gen-flowers.mjs v${VERSION} - edit the generator, not this file.\n`
  + `export const FLOWERS_W = ${W}\nexport const FLOWERS_H = ${H}\n`
  + `export const FLOWERS = ${JSON.stringify(svg)}\n`
if (out) writeFileSync(out, ts)
if (outSvg) writeFileSync(outSvg, svg)
