// dusk-glass v0.9 scene generator.
//
// BEHAVIOUR SPEC (written before building; checked numerically below):
//  BEE - a real bee wanders: heading drifts randomly, it darts (a sharp
//   turn plus a burst of speed), hovers for a moment and sets off in a new
//   direction, crosses its own path and roams the whole screen. Travel is
//   sideways overall, with real climbs and dives. Model: heading with an
//   Ornstein-Uhlenbeck turn rate (correlated random turning), a weak torque
//   toward horizontal headings (sin 2θ), Poisson darts and hovers, soft
//   walls at the screen edges, a slowly varying cruise speed.
//   Pass: horizontal share (|cos θ| > .7) 50-88 %, y range ≥ 480 u,
//   self-crossings ≥ 5, ≥ 10 of 12 screen cells visited, ≥ 6 turn-rounds,
//   ≥ 10 darts, ≥ 3 hovers, no straight run (< 10° heading change) > 2.5 s,
//   ≤ 2 % of the visit off screen.
//  FIREFLY - a slow, hovering wander anywhere; hindwings buzz (discrete
//   frames, ~20 Hz) with a faint blur ghost; dark between flashes; on each
//   flash it swoops in a J (dip, then climb), as Photinus fireflies do.
//  LIGHT - it must behave like light, not paint: ADDED to the sky
//   (mix-blend-mode plus-lighter), blurred in linear light, a white-hot core
//   with colour only in the falloff, a heavy-tailed falloff (four cascaded
//   blur levels: 1, 3, 8, 22 u) plus an anamorphic streak, firefly
//   yellow-green (~560 nm) in both themes, and the lamp lights its own wings.
//
//  SIZE (v0.13) - the app refuses a backdrop drawing over 131072 characters, and
//   the sky now carries the flowers too: the scene must stay <= 90000. The bee is
//   simulated at 16 Hz but STORED at 8 Hz (every second sample, an odd sample
//   count so the stored ones stay evenly spaced); its trail is laid along the
//   stored points and measured along them, so the dots still leave the sting.
//
// usage: node tools/gen-scene.mjs hooks/scene.ts [sheet.svg] [debug.svg]   (env SEED; LIGHT=filter for the reference build)
import { writeFileSync, readFileSync } from 'node:fs'

const VERSION = '1.0.0'
const SCENE_MAX = 90000
const BEE_SCALE = 1.0   // v0.17.1: about 38 px long (0.6 until v0.16, 1.2 in v0.17.0)
// v0.17.1: the flight is PLAYED this many times faster than it was simulated (a bigger bee reads as
// slower, so it flies faster; v0.17.0 had not changed the flight: same 1002 points, same
// 125.19 s as v0.16.1). The route, the trail and every turn stay as they were; only the four clocks
// that play them (motion, tilt, facing, trail) run shorter, and the spec checks they are ONE duration.
const BEE_TEMPO = 1.2
const SEED = +(process.env.SEED || 7)

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const R = rng(SEED)
const rr = (a, b) => a + (b - a) * R()
const gauss = () => Math.sqrt(-2 * Math.log(1 - R())) * Math.cos(2 * Math.PI * R())
const n1 = v => +v.toFixed(1)
const n2 = v => +v.toFixed(2)
const D2R = Math.PI / 180
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d }

// =====================================================================
// THE BEE - side view, facing +x, origin at the thorax. Pen strokes only.
// =====================================================================
const BEE = {
  head: 'M9.9 -2.3 C8.7 -4 5.7 -3.8 5 -1.3 C4.5 .9 6.3 2.4 8.3 2 C10.3 1.6 10.9 -.6 9.5 -2.6',
  eye: [8.3, -1.1, 0.62],
  antenna: 'M7.9 -3.4 C8.1 -4.6 8.6 -5.5 9.3 -5.9 C10.2 -6.4 11.3 -6.3 12.3 -5.7',
  thorax: 'M4.4 -2.3 C3.4 -4 .1 -4.1 -1.5 -2.2 C-2.8 -.6 -2.3 2.4 .1 3.3 C2.3 4 4.6 2.8 5 .7 C5.2 -.5 4.9 -1.5 4.2 -2.5',
  abdomen: 'M-1.7 -1.6 C-4.2 -3.3 -8.6 -2.9 -10.5 -.3 C-11.3 .8 -11.4 1.8 -11.3 2.6 C-10.4 3.9 -8.1 5.1 -5.6 5 C-3.3 4.9 -1.6 3.8 -1.2 2.4',
  sting: 'M-11.3 2.6 L-12.7 3.3',
  stripes: 'M-4.6 -2.6 C-5.7 -.6 -5.6 2.6 -4.3 4.9 M-7.7 -2.1 C-8.7 -.2 -8.5 2.5 -7.3 4.6',
  legs: 'M.9 3.4 L.6 5.3 L-.4 6.6 M2.6 3.3 L3 5.2 L2.3 6.8 M-1 2.7 L-2.2 4.5 L-3.7 5.4',
  wing: 'M0 0 C-.9 -2.4 -4.6 -7 -7.6 -6.9 C-9.6 -6.8 -9.2 -4 -6.9 -2.4 C-4.7 -.9 -2 -.2 0 0',
  hind: 'M0 0 C-1.2 -1.4 -4.4 -3.4 -6.2 -2.9 C-7.6 -2.5 -7 -.9 -5.2 -.3 C-3.5 .2 -1.5 .2 0 0',
}
const STING_TIP = [-12.7, 3.3]
const WING_ROOT = [1.2, -3.4]
const flap = (dur, begin) => `<animateTransform attributeName="transform" type="rotate" calcMode="discrete" values="30;8;-16;8" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>`
const BEE_ART = `
<g class="ink">
  <g transform="translate(${WING_ROOT[0] - 0.9} ${WING_ROOT[1] + 0.2})" class="far"><g>${flap(0.064, -0.012)}<path d="${BEE.wing}"/><path d="${BEE.hind}"/></g></g>
  <path d="${BEE.abdomen}"/><path d="${BEE.sting}"/>
  <path d="${BEE.stripes}" class="thin"/>
  <path d="${BEE.legs}" class="thin"/>
  <path d="${BEE.thorax}"/>
  <path d="${BEE.head}"/><path d="${BEE.antenna}" class="thin"/>
  <circle cx="${BEE.eye[0]}" cy="${BEE.eye[1]}" r="${BEE.eye[2]}" class="dot"/>
  <g transform="translate(${WING_ROOT[0]} ${WING_ROOT[1]})"><g>${flap(0.064, 0)}<path d="${BEE.wing}"/><path d="${BEE.hind}"/></g></g>
</g>`

// =====================================================================
// THE FIREFLY - round body, a pair of hindwings buzzing in discrete frames
// (~20 Hz, each side half a beat apart) with a faint ghost where the blur
// would be. The LIGHT version is the lamp plus the same buzzing wings,
// drawn in light, which the bloom filter turns into glow: the lamp lights
// its own wings.
// =====================================================================
const FF_WING = 'M0 0 C-.6 -1.6 -2.6 -3.6 -4.1 -3.3 C-5.2 -3.1 -4.7 -1.6 -3.4 -.8 C-2.2 -.1 -1 0 0 0'
const buzz = begin => `<animateTransform attributeName="transform" type="rotate" calcMode="discrete" values="-14;10;34;10" dur=".052s" begin="${begin}s" repeatCount="indefinite"/>`
const WINGS = `<g transform="translate(-.2 -1.5)">
  <g><g>${buzz(0)}<path d="${FF_WING}"/></g></g>
  <g transform="scale(-1 1)"><g>${buzz(-0.013)}<path d="${FF_WING}"/></g></g>
</g>`
const GHOST = `<g transform="translate(-.2 -1.5)" class="ghost"><path d="${FF_WING}" transform="rotate(12)"/><path d="${FF_WING}" transform="scale(-1 1) rotate(12)"/></g>`
const FF_DRAW = `${GHOST}<g class="ffink"><circle r="1.9"/>${WINGS}</g>`
const FF_LIGHT_FILTER = `<g filter="url(#ffbloom)"><g class="wlit">${WINGS}</g><circle r="1.9" class="lamp"/></g>`
// v0.16.1 LIGHT. The full bloom filter (ffbloom below: 15 primitives over 220 x 140 u, per lit firefly) put the
// sky over app 6.28899's per-frame cost limit: the app's own player, replayed faithfully, stilled the sky in 2 of
// 3 runs (at 3.1 s and 6.2 s). This light, replayed the same way: played in 3 of 3, worst 3 s window 2.71 ms
// against the ~5.56 ms limit (headless Edge on the Intel GPU; the runs were not interleaved with the old build).
// Now: the filter's NEAR terms (blur 1.1 and 3 of the lamp and wings, plus the source) by its own primitives on a
// 48 x 48 u region (ffnear), so the wings and the white-hot core ARE the filter's; and its FAR terms (blur 8, 22
// and the streak) as gradients FITTED to it, read from tools/fflight-fit.json (made by a fitting tool not included in this repository,
// against a LIGHT=filter build; its measured fit, including its miss, is in that file and the scene header).
// LIGHT=filter rebuilds the reference scene with the full filter, for a refit.
const LIGHT_MODE = process.env.LIGHT || 'fit'
const FIT = JSON.parse(readFileSync(new URL('./fflight-fit.json', import.meta.url), 'utf8'))
const FF_LIGHT_FIT = `<g class="iso">${FIT.parts.FAR}${FIT.parts.CORE}${FIT.parts.STREAK}<g filter="url(#ffnear)" class="add"><g class="wlit">${WINGS}</g><circle r="1.9" class="lamp"/></g></g>`
const FF_LIGHT = LIGHT_MODE === 'filter' ? FF_LIGHT_FILTER : FF_LIGHT_FIT

// =====================================================================
// THE BEE'S FLIGHT - a correlated random walk with darts and hovers.
// Visible area in a typical 16:9-ish window is about y 63-937 of the 1600 x 1000 scene.
// =====================================================================
const HZ = 16, DT = 1 / HZ
const BOX = { x0: 150, x1: 1450, y0: 120, y1: 880 }
const VISIT = 100
function flyBee() {
  const S = []
  const fromLeft = R() < 0.5
  let x = fromLeft ? -50 : 1650, y = rr(260, 640)
  let th = fromLeft ? rr(-0.25, 0.25) : Math.PI + rr(-0.25, 0.25)
  let w = 0, v = 100, mode = 'cruise', modeT = 0, dartTh = 0, t = 0, exiting = false
  const exitTh = R() < 0.5 ? Math.PI : 0
  const darts = [], hovers = []
  for (;;) {
    if (t > VISIT) exiting = true
    const inside = x > BOX.x0 && x < BOX.x1 && y > BOX.y0 && y < BOX.y1
    if (mode === 'cruise' && !exiting && inside && t > 2) {
      if (R() < DT / 3.4) {
        mode = 'dart'; modeT = rr(0.22, 0.42)
        // turn by a random large angle, preferring to end up flying sideways
        let best = th, bs = -9
        for (let k = 0; k < 3; k++) { const c = th + (R() < 0.5 ? -1 : 1) * rr(0.8, 2.7), sc = Math.abs(Math.cos(c)) + R() * 0.6; if (sc > bs) { bs = sc; best = c } }
        dartTh = best; darts.push(t)
      } else if (t > 5 && R() < DT / 12) { mode = 'hover'; modeT = rr(0.7, 1.5); hovers.push(t) }
    }
    modeT -= DT
    if (mode !== 'cruise' && modeT <= 0) {
      if (mode === 'hover') th += (R() < 0.5 ? -1 : 1) * rr(0.7, 2.4)
      mode = 'cruise'
    }
    // correlated random turning + a pull toward sideways headings
    w += (-w / 0.75) * DT + 2.4 * Math.sqrt(DT) * gauss()
    let omega = w - 0.75 * Math.sin(2 * th)
    if (!exiting) {
      const pen = Math.max(BOX.x0 - x, x - BOX.x1, BOX.y0 - y, y - BOX.y1, 0)
      if (pen > 0) { omega += angDiff(th, Math.atan2(500 - y, 800 - x)) * Math.min(5, 1 + pen / 30); if (mode === 'dart') mode = 'cruise' }
    } else omega += angDiff(th, exitTh) * 1.6
    let vT
    if (mode === 'dart') { omega = Math.max(-10, Math.min(10, angDiff(th, dartTh) * 14)); vT = 210 }
    else if (mode === 'hover') { omega *= 0.25; vT = 8 }
    else vT = 92 + 26 * Math.sin(t * 0.41 + 1) + 14 * Math.sin(t * 1.3)
    th += omega * DT
    v += (vT - v) * Math.min(1, (mode === 'dart' ? 9 : 3) * DT)
    x += v * Math.cos(th) * DT
    y += v * Math.sin(th) * DT
    S.push({ x, y, th, v, mode, t })
    t += DT
    if (exiting && (x < -70 || x > 1670)) break
    if (t > VISIT + 40) throw new Error('bee never left')
  }
  return { S, darts, hovers }
}
const { S: SIM, darts, hovers } = flyBee()
// a small buzz on top (perpendicular to travel, slow enough for 16 Hz)
const S = SIM.map((q, i) => {
  const tt = i * DT, b = 0.9 * Math.sin(2 * Math.PI * 2.3 * tt) + 0.45 * Math.sin(2 * Math.PI * 3.7 * tt + 1)
  return { x: q.x - Math.sin(q.th) * b, y: q.y + Math.cos(q.th) * b, th: q.th, v: q.v, mode: q.mode }
})
const flownN = S.length
const AWAY = 5
for (let i = 0; i < AWAY * HZ; i++) S.push({ ...S[flownN - 1], mode: 'away' })
if (S.length % 2 === 0) S.push({ ...S[flownN - 1], mode: 'away' })
// the stored samples: every second one, first and last included
const IDX = []
for (let i = 0; i < S.length; i += 2) IDX.push(i)
const DUR = S.length * DT            // simulated seconds
const PLAY = DUR / BEE_TEMPO         // played seconds (v0.17.1)

// facing: turn round when sideways velocity really reverses (|vx| > 25 for
// 0.2 s) and not within 0.6 s of the last turn; a hover keeps the facing.
const face = []
const flipTimes = []
{
  let want = Math.cos(S[0].th) >= 0 ? 1 : -1, cur = want, last = -99, hold = 0
  const step = 2 * DT / 0.18
  for (let i = 0; i < S.length; i++) {
    const q = S[i], tt = i * DT, vx = q.v * Math.cos(q.th)
    if (q.mode !== 'hover' && q.mode !== 'away' && Math.sign(vx) !== want && Math.abs(vx) > 25) hold += DT; else hold = 0
    if (hold >= 0.2 && tt - last > 0.6) { want = -want; last = tt; hold = 0; flipTimes.push(tt) }
    cur = Math.max(-1, Math.min(1, cur + Math.max(-step, Math.min(step, want - cur))))
    face.push(+cur.toFixed(6))
  }
}
// tilt: nose follows climbs and dives a little (at most 22 degrees), low-passed
const angRaw = S.map((q, i) => {
  let phi = (face[i] >= 0 ? q.th : q.th - Math.PI) / D2R
  while (phi > 180) phi -= 360
  while (phi < -180) phi += 360
  return Math.max(-22, Math.min(22, phi * 0.45))
})
const ang = []
for (let i = 0, a = angRaw[0]; i < angRaw.length; i++) { a += (angRaw[i] - a) * 0.3; ang.push(a) }
// the trail is laid by the sting
const tip = S.map((q, i) => {
  const lx = face[i] * STING_TIP[0] * BEE_SCALE, ly = STING_TIP[1] * BEE_SCALE
  const c = Math.cos(ang[i] * D2R), sn = Math.sin(ang[i] * D2R)
  return { x: q.x + lx * c - ly * sn, y: q.y + lx * sn + ly * c }
})
// arc length along the STORED trail points (the path that is drawn), so the
// trail window stays on the sting
const sAt = [0]
for (let k = 1; k < IDX.length; k++) {
  const i = IDX[k], h = IDX[k - 1]
  sAt.push(sAt[k - 1] + (i < flownN ? Math.hypot(tip[i].x - tip[h].x, tip[i].y - tip[h].y) : 0))
}
const TL = sAt[IDX.filter(i => i < flownN).length - 1]

// ---------- the spec, measured ----------
const spec = []
{
  const vis = S.slice(0, flownN).map((q, i) => ({ ...q, i })).filter(q => q.x > 0 && q.x < 1600 && q.y > 63 && q.y < 937)
  const firstIn = vis[0].i, lastIn = vis.at(-1).i
  const visit = S.slice(firstIn, lastIn + 1)
  const cruise = visit.filter(q => q.mode !== 'hover')
  const horiz = cruise.filter(q => Math.abs(Math.cos(q.th)) > 0.7).length / cruise.length
  const ys = visit.map(q => q.y), yRange = Math.max(...ys) - Math.min(...ys)
  const P = visit.filter((_, i) => i % 4 === 0)
  let cross = 0
  const segX = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)); return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b) }
  for (let i = 0; i < P.length - 1; i++) for (let j = i + 3; j < P.length - 1; j++) if (segX(P[i], P[i + 1], P[j], P[j + 1])) cross++
  const cells = new Set(visit.map(q => `${Math.floor((q.x / 1600) * 4)},${Math.floor(((q.y - 63) / 874) * 3)}`).filter(k => /^[0-3],[0-2]$/.test(k)))
  let longest = 0
  for (let i = 0; i < visit.length;) { let j = i; while (j + 1 < visit.length && Math.abs(angDiff(visit[i].th, visit[j + 1].th)) < 10 * D2R) j++; longest = Math.max(longest, (j - i) * DT); i = j + 1 }
  const off = visit.filter(q => !(q.x > 0 && q.x < 1600 && q.y > 63 && q.y < 937)).length / visit.length
  const gaps = flipTimes.slice(1).map((v, i) => v - flipTimes[i])
  spec.push(['horizontal share', horiz, horiz >= 0.5 && horiz <= 0.88])
  spec.push(['y range', yRange, yRange >= 480])
  spec.push(['self-crossings', cross, cross >= 5])
  spec.push(['cells visited /12', cells.size, cells.size >= 10])
  spec.push(['turn-rounds', flipTimes.length, flipTimes.length >= 6])
  spec.push(['min gap between turns s', gaps.length ? Math.min(...gaps) : 99, !gaps.length || Math.min(...gaps) >= 0.6])
  spec.push(['darts', darts.length, darts.length >= 10])
  spec.push(['hovers', hovers.length, hovers.length >= 3])
  spec.push(['longest straight run s', longest, longest <= 2.5])
  spec.push(['off-screen share', off, off <= 0.02])
}

const motionValues = IDX.map(i => `${n1(S[i].x)},${n1(S[i].y)}`).join(';')
const angValues = IDX.map(i => n1(ang[i])).join(';')
const faceD = IDX.map(i => face[i])
const fk = [[0, faceD[0]]]
for (let i = 1; i < faceD.length - 1; i++) if (Math.abs((faceD[i] - faceD[i - 1]) - (faceD[i + 1] - faceD[i])) > 1e-6) fk.push([i, faceD[i]])
fk.push([faceD.length - 1, faceD.at(-1)])
{ // receipt: the sparse facing keys reproduce every stored sample
  let worst = 0, j = 0
  for (let i = 0; i < faceD.length; i++) {
    while (fk[j + 1][0] < i) j++
    const [i0, v0] = fk[j], [i1, v1] = fk[j + 1]
    worst = Math.max(worst, Math.abs(v0 + (v1 - v0) * (i - i0) / (i1 - i0) - faceD[i]))
  }
  if (worst > 0.02) throw new Error(`facing keys reproduce the flight badly (worst ${worst.toFixed(3)})`)
}
const fkTimes = fk.map(([i]) => (i / (faceD.length - 1)).toFixed(5)).join(';')
const fkValues = fk.map(([, v]) => `${n2(v)} 1`).join(';')

const TRAIL_D = 'M' + IDX.filter(i => i < flownN).map(i => `${n1(tip[i].x)} ${n1(tip[i].y)}`).join('L')
// v0.16 - THE TRAIL IS DRAWN, NOT MASKED. App v6 turns a backdrop off when sampling it costs
// more than 5.56 ms a frame (averaged over 3 s). v0.15 dashed all 1,643 dots along the whole
// 11,503 u route every frame and hid all but the last 175 u under a full-size mask: about half
// of the sky's cost. Now only the 26 dots that show are drawn, in four bands, nearest darkest,
// at v0.15's opacities. Each dot sits at a fixed DOT step along the route, so the offset moves
// in whole DOT steps (calcMode discrete): dots are LAID, never dragged. Each step's value is
// taken at the START of its step, so a dot never shows before the sting has passed it.
const K = Math.ceil(TL + 400), GAP_BEHIND = 0.8, DOT = 7
const BAND_D = [[0, 35], [42, 77], [84, 119], [126, 175]]      // dot distances behind the newest dot
const BAND_OP = [4, 3, 2, 1].map(n => +(0.5 * (1 - 0.64 ** n)).toFixed(3)) // v0.15: .5 x (1 - .64^n), n mask windows over it
const bandDash = ([dNear, dFar]) => `0 ${K - dFar}${' 0 7'.repeat((dFar - dNear) / DOT)} 0 999999`
const LEN = sAt.length
const sAtU = u => { const a = Math.floor(u), b = Math.min(LEN - 1, a + 1); return sAt[a] + (sAt[b] - sAt[a]) * (u - a) }
const stepStart = k => k * (LEN - 1) / LEN, stepEnd = k => Math.min(LEN - 1, (k + 1) * (LEN - 1) / LEN)
const quant = at => Array.from({ length: LEN }, (_, k) => DOT * Math.floor((sAtU(at(k)) - GAP_BEHIND) / DOT))
const trailQ = quant(stepStart)
const trailOffsets = trailQ.map(q => K - q).join(';')
const bandCss = BAND_D.map((b, i) => `.t${i} { stroke-opacity: ${BAND_OP[i]}; stroke-dasharray: ${bandDash(b)} }`).join(' ')
const bandUse = BAND_D.map((_, i) => `<use href="#tp" class="t${i}"/>`).join('')

// =====================================================================
// FIREFLIES - six, each a slow correlated random walk over the whole
// screen with frequent hovers, sampled at 2 Hz and closed into a loop.
// =====================================================================
function flyFirefly(x0, y0, T) {
  const hz = 2, dt = 1 / hz, N = Math.round(T * hz)
  let x = x0, y = y0, th = rr(0, 6.28), w = 0, v = 18, hov = 0
  const P = []
  for (let i = 0; i < N; i++) {
    w += (-w / 2.2) * dt + 0.8 * Math.sqrt(dt) * gauss()
    let om = w - 0.3 * Math.sin(2 * th)
    const pen = Math.max(170 - x, x - 1430, 150 - y, y - 860, 0)
    if (pen > 0) om += angDiff(th, Math.atan2(500 - y, 800 - x)) * Math.min(3, 0.6 + pen / 50)
    th += om * dt
    if (hov <= 0 && R() < dt / 9) hov = rr(1.5, 4)
    hov -= dt
    const vT = hov > 0 ? 3 : 16 + 10 * Math.sin(i * 0.11 + x0)
    v += (vT - v) * 0.5
    x += v * Math.cos(th) * dt; y += v * Math.sin(th) * dt
    P.push({ x, y })
  }
  // close the loop: spread the end-to-start gap over the whole walk
  const gx = P.at(-1).x - P[0].x, gy = P.at(-1).y - P[0].y
  const Q = P.map((p, i) => ({ x: p.x - gx * i / (N - 1), y: p.y - gy * i / (N - 1) }))
  Q.push({ ...Q[0] })
  return Q
}
const FLY_STARTS = [[330, 700], [800, 560], [1250, 720], [560, 300], [1100, 290], [880, 840]]
// v0.10: one glow curve for light AND lines (GLOW below), ONE 11 s period (unequal periods drift into clumps: 5+ lit 17-20% of the time), and phases
// spread evenly round the cycle. v0.9 drew each delay at random, so the phases were
// measured from the moment the backdrop mounts and 4 of 6 started inside their lit
// window: every mount opened with a burst, then the sky thinned to ~1.5 lit.
// (The rr() calls are kept one-for-one so the walks are the same as v0.9.)
const flies = FLY_STARTS.map(([x, y], i) => {
  const T = rr(70, 110)
  const pts = flyFirefly(x, y, T)
  const per = rr(11, 11), jit = rr(0, 9) / 9          // v0.10's timing, kept for its fixture
  const del = ((i * 5) % FLY_STARTS.length + 0.15 + 0.5 * jit) / FLY_STARTS.length * per
  return { T, pts, per, del, bob: rr(3.2, 5.2), bdel: rr(0, 5), sc: rr(0.9, 1.1) }
})

// ---- v0.11: a SCHEDULE, not a blink rate (the brief: one or two lit at a time, always, at random) ----
// One shared loop of L seconds. A chain of flashes, each starting so its lit window opens
// a random 0.2-3.2 s before the previous one's closes: never none lit, only ever a brief two.
// Then random extra flashes, accepted only where they keep the count at two or fewer.
// Each flash goes to a random free firefly (dark at least GAP s either side, round the
// loop). Holds, fades and overlaps are all random, so the rhythm never repeats inside L.
// Its own RNG, so the walks and the bee are untouched.
const SR = rng(SEED * 7919 + 11), sr = (a, b) => a + (b - a) * SR()
const NF = FLY_STARTS.length, GAP = 3, L_TARGET = 118
const flashOf = s => ({ s, fi: sr(1.6, 2.2), h: sr(2.2, 8), fo: sr(2.2, 3) })
const flashKeys = f => [[f.s, 0], [f.s + f.fi, 1], [f.s + f.fi + f.h, 0.88], [f.s + f.fi + f.h + f.fo, 0]]
const flashEnd = f => f.s + f.fi + f.h + f.fo
// eased value between keys [[t, v]...] (CSS applies the timing function to EACH segment)
const keyVal = (K, t) => { if (t <= K[0][0]) return K[0][1]; for (let k = 1; k < K.length; k++) if (t <= K[k][0]) { const [x0, y0] = K[k - 1], [x1, y1] = K[k]; return x1 === x0 ? y1 : y0 + (y1 - y0) * ease((t - x0) / (x1 - x0)) } return K.at(-1)[1] }
const winAt = (f, th) => { const K = flashKeys(f); let a = null, b = null; for (let t = f.s; t <= flashEnd(f); t += 0.01) { if (keyVal(K, t) >= th) { if (a === null) a = t; b = t } } return [a, b] }
const litWin = f => { const K = flashKeys(f); let a = null, b = null; for (let t = f.s; t <= flashEnd(f); t += 0.01) { if (keyVal(K, t) >= 0.5) { if (a === null) a = t; b = t } } return [a, b] }
function schedule(tryNo) {
  const chain = [flashOf(0)]
  for (;;) {
    const last = chain.at(-1), [, b] = litWin(last), nxt = flashOf(0), [a0] = litWin({ ...nxt, s: 0 })
    nxt.s = b - sr(0.2, 3.2) - a0
    // never a third: the new one shows (>=.25) only after the one two places back has faded below .25
    if (chain.length >= 2) { const [, e2] = winAt(chain.at(-2), 0.25), [v0] = winAt({ ...nxt, s: 0 }, 0.25); nxt.s = Math.max(nxt.s, e2 + 0.2 - v0) }
    if (litWin({ ...nxt })[0] > b - 0.1) nxt.s -= litWin({ ...nxt })[0] - (b - 0.1)   // and never none
    if (nxt.s >= L_TARGET) { const [a] = litWin(chain[0]); return finish(chain, b - sr(0.2, 3.2) - a + chain[0].s, tryNo) }
    chain.push(nxt)
  }
}
function finish(chain, L, tryNo) {
  const all = chain.map(f => ({ ...f, fly: -1 }))
  const cnt = new Uint8Array(Math.ceil(L / 0.05))
  const vis = new Uint8Array(cnt.length)
  const mark = f => { const K = flashKeys(f); for (let t = f.s; t < flashEnd(f); t += 0.05) { const v = keyVal(K, t), b = Math.floor((((t % L) + L) % L) / 0.05); if (v >= 0.5) cnt[b]++; if (v >= 0.25) vis[b]++ } }
  const free = (fly, f, list) => list.every(g => g.fly !== fly || [-L, 0, L].every(sh => flashEnd(g) + sh + GAP <= f.s || flashEnd(f) + GAP <= g.s + sh))
  const pick = (f, list) => { const c = [...Array(NF).keys()].filter(k => free(k, f, list)); return c.length ? c[Math.floor(SR() * c.length)] : -1 }
  for (const f of all) { f.fly = pick(f, all); if (f.fly < 0) return null; mark(f) }
  // extra flashes at random times until about 30% of the time has two lit
  for (let tries = 0; tries < 400; tries++) {
    const two = cnt.filter(c => c >= 2).length / cnt.length
    if (two >= 0.3) break
    const f = flashOf(sr(0, L)), K = flashKeys(f)
    let ok = true
    for (let t = f.s; t < flashEnd(f) && ok; t += 0.05) if (keyVal(K, t) >= 0.25 && vis[Math.floor((t % L) / 0.05)] >= 2) ok = false   // admitted only where even a faint third would not show
    if (!ok) continue
    f.fly = pick(f, all); if (f.fly < 0) continue
    all.push(f); mark(f)
  }
  return { L, all, tryNo }
}
let SCH = null
for (let k = 0; k < 50 && !SCH; k++) SCH = schedule(k)
if (!SCH) throw new Error('no firefly schedule fits the gap rule')
const LOOP = SCH.L
// per-firefly keys over [0, L]: flashes shifted by -L, 0, +L so a flash that crosses the
// loop's end is split, and the value at 0 and at L is the same number.
const loopKeys = (pts) => {
  pts.sort((p, q) => p[0] - q[0])
  const at = t => { if (!pts.length) return 0; return keyVal(pts, t) }
  const inside = pts.filter(([t]) => t > 0.005 && t < LOOP - 0.005)
  return [[0, at(0)], ...inside, [LOOP, at(LOOP)]]
}
const J = [[0, [0, 0]], [0.5, [3, 5]], [1, [7, 4]], [1.3, [10, -6]], [1.8, [11, -15]], [2, [11, -16]]]   // 0..1 = fade-in, 1..2 = hold+fade-out
const flyKeys = flies.map((_, i) => {
  const mine = SCH.all.filter(f => f.fly === i), G = [], JX = [], JY = []
  for (const f of mine) for (const sh of [-LOOP, 0, LOOP]) {
    for (const [t, v] of flashKeys(f)) G.push([t + sh, v])
    const tAt = u => f.s + sh + (u <= 1 ? u * f.fi : f.fi + (u - 1) * (f.h + f.fo))
    for (const [u, [x, y]] of J) { JX.push([tAt(u), x]); JY.push([tAt(u), y]) }
    JX.push([flashEnd(f) + sh + 2.4, 0]); JY.push([flashEnd(f) + sh + 2.4, 0])   // back to rest while dark
  }
  return { glow: loopKeys(G), jx: loopKeys(JX), jy: loopKeys(JY), n: mine.length }
})
const pct = t => `${+(t / LOOP * 100).toFixed(2)}%`
// v0.16: a firefly is visibility:hidden wherever its glow keyframe is 0 (visibility interpolates
// as "visible if either end is", so a fade in or out is never cut short). CORRECTION: this does
// NOT spare the dark ones' bloom - measured, a hidden group still runs its filter. What spares it
// is the display switch on the light's <use> below; this keyframe only keeps a dark fly undrawn.
// v0.17 ONE CLOCK: display rides these SAME keyframes (none wherever the key is 0). Chromium keeps a
// keyframe animation running while its own keyframes set display:none, and between a none key and
// an inline key the value is inline for the whole segment, exactly as visibility behaves. So the
// light is switched off while dark (its filter is not run) by the one animation that fades it.
const kfGlow = (i, K) => `@keyframes fg${i} { ${K.map(([t, v]) => `${pct(t)} { opacity: ${+v.toFixed(2)}; visibility: ${+v.toFixed(2) > 0 ? 'visible' : 'hidden'}; display: ${+v.toFixed(2) > 0 ? 'inline' : 'none'} }`).join(' ')} }`
const kfJ = (i, X, Y) => `@keyframes fj${i} { ${X.map(([t, x], k) => `${pct(t)} { transform: translate(${+x.toFixed(1)}px,${+Y[k][1].toFixed(1)}px) }`).join(' ')} }`
// still frame when the app turns animation off: two fireflies lit (one bright, one less),
// the other four dark - the same "one or two" as the moving sky, and no row of identical clones.
const REST = [0.95, 0, 0, 0, 0.62, 0]
const flyCss = flies.map((_, i) => `.fy${i} { animation-name: fg${i}; opacity: ${REST[i]} } .jy${i} { animation-name: fj${i} }\n  ${kfGlow(i, flyKeys[i].glow)}\n  ${kfJ(i, flyKeys[i].jx, flyKeys[i].jy)}`).join('\n  ')
// Motion is RELATIVE to a base translate at the walk's start: SMIL adds the two, so the
// path is unchanged while animating, and if the app strips animation (its static mode)
// each firefly rests at its start instead of all six stacking at the origin.
// v0.16: a firefly's LIGHT is display:none while it is dark, so its bloom filter is not run
// every frame. Measured first: visibility:hidden did NOT spare it (the light layer cost
// 3.2 ms either way; a hidden group still runs its filter). The switch is a SMIL animation
// on the light's own <use>, never on the CSS-animated group: display:none on that group
// would cancel and restart its glow animation and break the schedule. Padded DISP_PAD s
// either side of every glow so the SMIL and CSS clocks need not agree to the frame.
const DISP_PAD = 0.25
const litSpans = i => {
  const G = flyKeys[i].glow, raw = []
  for (let k = 0; k < G.length - 1; k++) if (G[k][1] > 0 || G[k + 1][1] > 0) raw.push([Math.max(0, G[k][0] - DISP_PAD), Math.min(LOOP, G[k + 1][0] + DISP_PAD)])
  const out = []
  for (const s of raw.sort((a, b) => a[0] - b[0])) { if (out.length && s[0] <= out.at(-1)[1]) out.at(-1)[1] = Math.max(out.at(-1)[1], s[1]); else out.push([...s]) }
  return out
}
const dispKeys = spans => {
  const kt = [], vals = []
  const push = (t, v) => { const k = +(t / LOOP).toFixed(5); if (kt.length && k <= kt.at(-1)) { vals[vals.length - 1] = v; return } kt.push(k); vals.push(v) }
  push(0, spans.length && spans[0][0] <= 0 ? 'inline' : 'none')
  for (const [a, b] of spans) { if (a > 0) push(a, 'inline'); if (b < LOOP) push(b, 'none') }
  return { kt, vals }
}
const dispAnim = spans => { const { kt, vals } = dispKeys(spans); return `<animate attributeName="display" dur="${LOOP.toFixed(2)}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${kt.join(';')}" values="${vals.join(';')}"/>` }
const flyGroup = (cls, ref) => flies.map((f, i) => {
  const p0 = f.pts[0]
  // v0.17: no SMIL display switch on the light. v0.16's ran on the SMIL clock, padded 0.25 s against
  // the CSS clock that fades the glow; measured, the two start 0.01-0.30 s apart on each mount.
  // The failing fixture for the one-clock gates is the shipped v0.16.1 scene itself
  // (_backups\dusk-glass-0.16.1): tools/check-glow.mjs must FAIL on it with the clocks split.
  const inner = `<use href="#${ref}"/>`
  return `<g transform="translate(${n1(p0.x)} ${n1(p0.y)})"><animateMotion dur="${f.T.toFixed(1)}s" repeatCount="indefinite" calcMode="linear" values="${f.pts.map(p => `${n1(p.x - p0.x)},${n1(p.y - p0.y)}`).join(';')}"/>` +
  `<g class="bob" style="animation-duration:${f.bob.toFixed(2)}s;animation-delay:-${f.bdel.toFixed(2)}s"><g class="jst jy${i}"><g class="${cls} fy${i}" transform="scale(${f.sc.toFixed(2)})">${inner}</g></g></g></g>`
}).join('\n')

// ---- the glow curve, and receipts that can fail (each is run on v0.9's values too) ----
const GLOW = [[0, 0], [20, 1], [54, 0.88], [78, 0], [100, 0]]          // % of period, opacity
const GLOW_V9 = [[0, 0], [7, 1], [15, 0.92], [32, 0], [100, 0]]
const V9_FLIES = [[8.57, 0.97], [8.32, 5.35], [7.59, 7.24], [7.54, 8.65], [8.14, 8.84], [5.84, 5.73]]
function ease(u) { // cubic-bezier(.42,0,.58,1) = ease-in-out, solved for x by bisection
  let a = 0, b = 1
  for (let k = 0; k < 40; k++) { const m = (a + b) / 2, x = 3 * m * (1 - m) ** 2 * 0.42 + 3 * m * m * (1 - m) * 0.58 + m ** 3; if (x < u) a = m; else b = m }
  const s = (a + b) / 2; return 3 * s * s * (1 - s) + s ** 3
}
const glowAt = (G, ph) => { const q = ((ph % 1) + 1) % 1 * 100; for (let k = 1; k < G.length; k++) if (q <= G[k][0]) { const [x0, y0] = G[k - 1], [x1, y1] = G[k]; return y0 + (y1 - y0) * ease((q - x0) / (x1 - x0)) } return 0 }
const spans = (G, per) => { let fin = 0, lit = 0, fout = 0, dark = 0; const n = 2000
  for (let k = 0; k < n; k++) { const ph = k / n, o = glowAt(G, ph), o2 = glowAt(G, ph + 1 / n)
    if (o >= 0.5) lit++; if (o < 0.05) dark++; else if (o2 > o + 1e-9) fin++; else if (o2 < o - 1e-9) fout++ }
  return { fin: fin / n * per, lit: lit / n * per, fout: fout / n * per, dark: dark / n * per } }
const density = (G, F, t1) => { let mn = 9, mx = 0, sum = 0, n = 0, zero = 0, open = 0, crowd = 0
  for (let t = 0; t <= t1; t += 0.1) { const c = F.filter(([per, del]) => glowAt(G, (t + del) / per) >= 0.5).length
    mn = Math.min(mn, c); mx = Math.max(mx, c); sum += c; n++; if (c === 0) zero++; if (c >= 5) crowd++; if (t <= 2) open = Math.max(open, c) }
  return { mn, mx, mean: sum / n, zero: zero / n, crowd: crowd / n, open } }
// light and lines must share ONE animation per firefly: every .fyN rule names fgN, and no
// .flight / .fdraw rule names an animation of its own
const cssSync = css => /\.fy0 \{ animation-name: fg0/.test(css) && [...Array(NF).keys()].every(i => new RegExp(`\\.fy${i} \\{ animation-name: fg${i};`).test(css)) && !/\.(flight|fdraw) \{[^}]*animation-name/.test(css)
const minOf = (S, k) => Math.min(...S.map(s => s[k]))
// what the browser will show: sample the EMITTED keys (eased per segment) every 0.05 s
const occ = (count, t1) => { const h = [0, 0, 0, 0, 0, 0, 0]; let n = 0, starts = [], prev = 0
  for (let t = 0; t < t1; t += 0.05) { const c = count(t); h[Math.min(6, c)]++; n++; if (c > prev) starts.push(t); prev = c }
  const iv = starts.slice(1).map((s, k) => s - starts[k]), m = iv.reduce((a, b) => a + b, 0) / (iv.length || 1)
  const cv = iv.length > 2 ? Math.sqrt(iv.reduce((a, b) => a + (b - m) ** 2, 0) / iv.length) / m : 0
  return { one2: (h[1] + h[2]) / n, zero: h[0] / n, three: h.slice(3).reduce((a, b) => a + b, 0) / n, two: h[2] / n, mean: h.reduce((a, c, k) => a + c * k, 0) / n, cv } }
const glowOf = i => t => keyVal(flyKeys[i].glow, ((t % LOOP) + LOOP) % LOOP)
const O11 = occ(t => flies.filter((_, i) => glowOf(i)(t) >= 0.5).length, 600)
const V11 = occ(t => flies.filter((_, i) => glowOf(i)(t) >= 0.25).length, 600)      // "visible", stricter
const O10 = occ(t => flies.filter(f => glowAt(GLOW, (t + f.del) / f.per) >= 0.5).length, 600)
const fewOk = O => O.one2 >= 0.95 && O.zero <= 0.03 && O.three <= 0.02 && O.cv >= 0.3
const fmt = O => `1-2 lit ${O.one2.toFixed(3)}, none ${O.zero.toFixed(3)}, 3+ ${O.three.toFixed(3)}, two ${O.two.toFixed(2)}, mean ${O.mean.toFixed(2)}, rhythm CV ${O.cv.toFixed(2)}`
// spans per flash from the shipped curve
const SP = SCH.all.map(f => { const [a, b] = litWin(f); return { fin: f.fi, lit: b - a, fout: f.fo } })
const gaps = flies.map((_, i) => { const m = SCH.all.filter(f => f.fly === i).sort((p, q) => p.s - q.s); return m.map((f, k) => (k + 1 < m.length ? m[k + 1].s : m[0].s + LOOP) - flashEnd(f)) }).flat()
const S9 = V9_FLIES.map(([p]) => spans(GLOW_V9, p))
const longOk = S => minOf(S, 'fin') >= 1.5 && minOf(S, 'lit') >= 4 && minOf(S, 'fout') >= 2
const glowSpec = [
  ['ff fade-in / lit / fade-out, s (min over flashes)', ['fin', 'lit', 'fout'].map(k => minOf(SP, k).toFixed(2)).join(' / '), longOk(SP)],
  ['  fixture v0.9 must FAIL', ['fin', 'lit', 'fout'].map(k => minOf(S9, k).toFixed(2)).join(' / '), !longOk(S9)],
  ['ff dark between own flashes, s (min)', +Math.min(...gaps).toFixed(2), Math.min(...gaps) >= GAP - 0.01],
  [`ff lit (>=.5) over 600 s, loop ${LOOP.toFixed(1)} s, ${SCH.all.length} flashes`, fmt(O11), fewOk(O11)],
  ['ff visible (>=.25) over 600 s: 3+ share', V11.three.toFixed(3), V11.three <= 0.03],
  ['  fixture v0.10 must FAIL', fmt(O10), !fewOk(O10)],
  ['still frame: fireflies drawn', REST.filter(r => r > 0).length, REST.filter(r => r > 0).length === 2],
]

// =====================================================================
const SCENE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<style>
  .b0 { stop-color: #f7e4d8 } .b1 { stop-color: #ece0f5 } .b2 { stop-color: #d8e5f7 }
  .g1 { stop-color: #ffc29e } .g2 { stop-color: #c2a9f2 } .g3 { stop-color: #addbf1 }
  .g4 { stop-color: #f6b1d0 } .g5 { stop-color: #dccbf8 }
  .ink, .ffink, .ghost { fill: none; stroke: #2a2133; stroke-width: .95; stroke-linecap: round; stroke-linejoin: round }
  .ink .thin { stroke-width: .7 } .ink .far { stroke-opacity: .45 } .dot { fill: #2a2133; stroke: none }
  .ffink { stroke-width: .5 } .ghost { stroke-width: .4; stroke-opacity: .28 }
  .lamp { fill: #fbffe6 } .wlit { fill: none; stroke: #e4ff7a; stroke-width: .6; stroke-opacity: .42 }
  .glowc { flood-color: #c4ff3a } .add { mix-blend-mode: plus-lighter } .iso { isolation: isolate }
  .trail { fill: none; stroke: #2a2133; stroke-width: 1.15; stroke-linecap: round }
  @media (prefers-color-scheme: dark) {
    .b0 { stop-color: #0f0e21 } .b1 { stop-color: #19143a } .b2 { stop-color: #0b1729 }
    .g1 { stop-color: #7a2c6e } .g2 { stop-color: #5a3cb8 } .g3 { stop-color: #13737d }
    .g4 { stop-color: #2a49a6 } .g5 { stop-color: #2a2054 }
    .ink, .ffink, .ghost, .trail { stroke: #efe8ff } .dot { fill: #efe8ff }
  }
  ${bandCss}

  .p { transform-box: fill-box; transform-origin: center; animation: 50s ease-in-out infinite alternate }
  .p1 { animation-name: d1; animation-duration: 47s } .p2 { animation-name: d2; animation-duration: 61s }
  .p3 { animation-name: d3; animation-duration: 53s } .p4 { animation-name: d4; animation-duration: 67s }
  .p5 { animation-name: d5; animation-duration: 41s }
  @keyframes d1 { to { transform: translate(-260px,140px) scale(1.18) } }
  @keyframes d2 { to { transform: translate(300px,-160px) scale(.88) } }
  @keyframes d3 { to { transform: translate(220px,190px) scale(1.15) } }
  @keyframes d4 { to { transform: translate(-280px,-120px) scale(1.12) } }
  @keyframes d5 { to { transform: translate(120px,-70px) scale(1.1) } }

  /* fireflies. The light layer is ADDED to the sky (plus-lighter), never painted over it.
     Dark between flashes; on a flash the light and the drawing come up together and the
     firefly swoops in a J (dip, then climb). Class-only selectors - an ancestor outside a
     use element does not match inside it; the custom properties inherit through. */
  .flylight { mix-blend-mode: plus-lighter; opacity: .55 }
  @media (prefers-color-scheme: dark) { .flylight { opacity: 1 } }
  .bob { animation: bob 4s ease-in-out infinite alternate }
  @keyframes bob { from { transform: translate(0,-3px) } to { transform: translate(0,3px) } }
  /* One SCHEDULE for all six over a ${LOOP.toFixed(1)} s loop: one or two glow at any moment, at
     random. Each firefly has ONE timeline (fgN) worn by its light and its lines alike, so
     they rise, hold and fade together, and a J swoop (fjN) that rests while it is dark.
     The resting opacity only shows when animation is off: then two are lit, four dark. */
  .jst, .flight, .fdraw { animation: ${LOOP.toFixed(2)}s ease-in-out infinite }
  ${flyCss}
  /* The bee and its trail exist only while animation runs: if the app turns animation off
     (reduced motion, or its static mode), a frozen bee would hang in mid-air. */
  .bee, .trail { opacity: 0; animation: alive 1s infinite }
  @keyframes alive { from, to { opacity: 1 } }

  @media (prefers-reduced-motion: reduce) {
    .p, .bob, .jst, .flight, .fdraw, .bee, .trail { animation: none }
  }
</style>
<defs>
  <linearGradient id="base" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="b0"/><stop offset=".55" class="b1"/><stop offset="1" class="b2"/></linearGradient>
  <radialGradient id="r1"><stop offset="0" class="g1" stop-opacity=".9"/><stop offset=".45" class="g1" stop-opacity=".45"/><stop offset="1" class="g1" stop-opacity="0"/></radialGradient>
  <radialGradient id="r2"><stop offset="0" class="g2" stop-opacity=".85"/><stop offset=".45" class="g2" stop-opacity=".42"/><stop offset="1" class="g2" stop-opacity="0"/></radialGradient>
  <radialGradient id="r3"><stop offset="0" class="g3" stop-opacity=".7"/><stop offset=".45" class="g3" stop-opacity=".35"/><stop offset="1" class="g3" stop-opacity="0"/></radialGradient>
  <radialGradient id="r4"><stop offset="0" class="g4" stop-opacity=".6"/><stop offset=".45" class="g4" stop-opacity=".3"/><stop offset="1" class="g4" stop-opacity="0"/></radialGradient>
  <radialGradient id="r5"><stop offset="0" class="g5" stop-opacity=".45"/><stop offset=".45" class="g5" stop-opacity=".22"/><stop offset="1" class="g5" stop-opacity="0"/></radialGradient>
  ${LIGHT_MODE === 'filter' ? `<!-- light, not paint: blurred in LINEAR light; a four-level cascade (each level blurs the
       one before, so no tiny value is ever boosted) gives a heavy-tailed falloff; the core
       stays white-hot and only the falloff carries colour; plus an anamorphic streak. All
       levels are ADDED (arithmetic k2 k3), and the layer is added to the sky by plus-lighter. -->
  <filter id="ffbloom" filterUnits="userSpaceOnUse" x="-110" y="-70" width="220" height="140" color-interpolation-filters="linearRGB">
    <feFlood class="glowc" result="col"/>
    <feGaussianBlur in="SourceGraphic" stdDeviation="1.1" result="L1"/>
    <feComposite in="col" in2="L1" operator="in" result="L1c"/>
    <feComposite in="L1c" in2="L1c" operator="arithmetic" k2="2.4" result="L1b"/>
    <feGaussianBlur in="L1b" stdDeviation="3" result="L2"/>
    <feComposite in="L2" in2="L2" operator="arithmetic" k2="2.6" result="L2b"/>
    <feGaussianBlur in="L2b" stdDeviation="8" result="L3"/>
    <feComposite in="L3" in2="L3" operator="arithmetic" k2="2.8" result="L3b"/>
    <feGaussianBlur in="L3b" stdDeviation="22" result="L4"/>
    <feGaussianBlur in="L2b" stdDeviation="38 .7" result="ST"/>
    <feComposite in="L4" in2="L3" operator="arithmetic" k2=".9" k3=".9" result="A1"/>
    <feComposite in="A1" in2="L2" operator="arithmetic" k2="1" k3="1" result="A2"/>
    <feComposite in="A2" in2="ST" operator="arithmetic" k2="1" k3=".9" result="A3"/>
    <feComposite in="A3" in2="L1" operator="arithmetic" k2="1" k3="1.2" result="A4"/>
    <feComposite in="A4" in2="SourceGraphic" operator="arithmetic" k2="1" k3="1"/>
  </filter>` : `<!-- light: the bloom's near terms (ffnear), its far terms as fitted gradients -->
  ${FIT.parts.NEAR}${FIT.parts.GF}${FIT.parts.GC}${FIT.parts.GS}`}
  <g id="bee-art">${BEE_ART}</g>
  <g id="ffdraw">${FF_DRAW}</g>
  <g id="fflight">${FF_LIGHT}</g>
  <path id="tp" d="${TRAIL_D}"/>
</defs>

<rect width="1600" height="1000" fill="url(#base)"/>
<ellipse class="p p5" cx="800" cy="470" rx="720" ry="420" fill="url(#r5)"/>
<ellipse class="p p1" cx="1380" cy="110" rx="560" ry="400" fill="url(#r1)"/>
<ellipse class="p p2" cx="230" cy="880" rx="680" ry="440" fill="url(#r2)"/>
<ellipse class="p p3" cx="110" cy="160" rx="480" ry="370" fill="url(#r3)"/>
<ellipse class="p p4" cx="1150" cy="930" rx="560" ry="330" fill="url(#r4)"/>

<g class="flylight">
${flyGroup('flight', 'fflight')}
</g>
<g class="flyink">
${flyGroup('fdraw', 'ffdraw')}
</g>

<g class="trail"><animate attributeName="stroke-dashoffset" dur="${PLAY.toFixed(2)}s" repeatCount="indefinite" calcMode="discrete" values="${trailOffsets}"/>${bandUse}</g>

<g class="bee">
  <g>
    <animateMotion dur="${PLAY.toFixed(2)}s" repeatCount="indefinite" calcMode="linear" values="${motionValues}"/>
    <g><animateTransform attributeName="transform" type="rotate" dur="${PLAY.toFixed(2)}s" repeatCount="indefinite" values="${angValues}"/>
    <g><animateTransform attributeName="transform" type="scale" dur="${PLAY.toFixed(2)}s" repeatCount="indefinite" keyTimes="${fkTimes}" values="${fkValues}"/>
    <g transform="scale(${BEE_SCALE})"><use href="#bee-art"/></g>
    </g></g>
  </g>
</g>
</svg>`

const header = `// dusk-glass v${VERSION} - the backdrop. GENERATED by tools/gen-scene.mjs; edit the generator, not this file.
// A dusk sky with life in it:
//  - five soft pools of light drifting on their own 41-67 s loops;
//  - six fireflies wandering the whole screen with hovers, dark between flashes;
//    each flash brings up the light and the pen drawing together and swoops in
//    a J. Light and lines share one timeline per firefly (~2 s up, 2.6-5 s lit,
//    ~2.6 s down). A ${LOOP.toFixed(0)} s schedule of ${SCH.all.length} flashes keeps one or two
//    glowing at any moment, at random times, never four at once. Hindwings buzz in discrete frames (~20 Hz). The light is ADDED
//    to the sky with plus-lighter: white-hot core, yellow-green falloff, and the lamp lights its own wings.
//    ${LIGHT_MODE === 'filter' ? 'REFERENCE build: the light is the full linear-light bloom filter (four cascaded blur levels + an anamorphic streak).' : `The light's near part is the bloom filter's own blur 1.1 and 3 terms on a 48 u square; its far part is gradients\n//    fitted to the full bloom. Measured against the full bloom, pose-averaged, at a 1.44x display scale:\n//    ${FIT.measuredText.replace(/\.$/, '')}`};
//  - one bee drawn in a few pen lines, side view, about ${Math.round(23 * BEE_SCALE / 0.6)} px, on a random
//    wander across the whole screen: mostly sideways, climbing and diving,
//    darting (${darts.length}), hovering (${hovers.length}), crossing its own path,
//    turning round ${flipTimes.length} times. Its sting lays a dotted trail that
//    fades over 175 units. Played ${BEE_TEMPO} times as fast as simulated: ${PLAY.toFixed(0)} s a visit, ${(AWAY / BEE_TEMPO).toFixed(1)} s of it away.
// With animation off ("reduce motion", or the app's static mode) it is a still dusk:
// two fireflies rest lit where they start, four stay dark, and the bee is not drawn.
`
const CSS_V9 = '.jst, .flight, .fdraw { animation: var(--per) ease-in-out var(--del) infinite }\n  .jst { animation-name: jstroke } .flight { opacity: 0; animation-name: flash } .fdraw { opacity: 0; animation-name: show }'
glowSpec.push(['light and lines share ONE animation (glow)', cssSync(SCENE), cssSync(SCENE)],
  ['  fixture v0.9 css must FAIL', cssSync(CSS_V9), !cssSync(CSS_V9)])
spec.push(...glowSpec)
// ---- v0.16 cost receipts; each check is also run on a fixture that must FAIL ----
{
  const dotsShown = dash => { let p = 0, n = 0; const a = dash.trim().split(/\s+/).map(Number); for (let i = 0; i < a.length; i++) { if (i % 2 === 0 && a[i] === 0 && p > 0 && p <= K) n++; p += a[i] } return n }
  const shown = BAND_D.reduce((n, b) => n + dotsShown(bandDash(b)), 0), shownV15 = Math.floor(TL / DOT) + 1
  const fewDots = n => n >= 20 && n <= 30
  const noMask = s => !/<mask\b|\smask="/.test(s)
  const laid = qs => qs.every(q => ((q % DOT) + DOT) % DOT === 0)
  const neverAhead = qs => qs.every((q, k) => q <= sAtU(stepStart(k)) - GAP_BEHIND + 1e-9)
  const lagMean = (qs, hold = 1) => { let t = 0, n = 0; for (let k = 0; k < LEN - hold; k++) for (let j = 0; j < 8; j++) { const u = stepStart(k) + j / 8 * (LEN - 1) / LEN; t += sAtU(u) - GAP_BEHIND - qs[k - (k % hold)]; n++ } return t / n }
  const lag = lagMean(trailQ), lag2Hz = lagMean(trailQ, 4)
  const visOk = css => { const fr = [...css.matchAll(/@keyframes fg\d+ \{(.*?)\} \}/g)].flatMap(m => [...m[1].matchAll(/\{ ([^}]*)/g)].map(f => f[1])); return fr.length > 0 && fr.every(f => { const o = /opacity: ([\d.]+)/.exec(f), v = /visibility: (visible|hidden)/.exec(f), d = /display: (inline|none)/.exec(f); return !!(o && v && d) && ((+o[1] > 0) === (v[1] === 'visible')) && ((+o[1] > 0) === (d[1] === 'inline')) }) }
  const kfV16 = flies.map((_, i) => `@keyframes fg${i} { ${flyKeys[i].glow.map(([t, v]) => `${pct(t)} { opacity: ${+v.toFixed(2)}; visibility: ${+v.toFixed(2) > 0 ? 'visible' : 'hidden'} }`).join(' ')} }`).join(' ')
  // v0.17 ONE CLOCK: nothing on the SMIL clock may switch a firefly's light on or off
  const oneClock = s => !/attributeName="(display|visibility|opacity)"/.test(s)
  const v16Use = `<use href="#fflight">${dispAnim(litSpans(0))}</use>`
  const kfV15 = flies.map((_, i) => `@keyframes fg${i} { ${flyKeys[i].glow.map(([t, v]) => `${pct(t)} { opacity: ${+v.toFixed(2)} }`).join(' ')} }`).join(' ')
  spec.push(
    ['trail dots drawn a frame (20-30)', shown, fewDots(shown)],
    ['  fixture v0.15 whole-route dots must FAIL', shownV15, !fewDots(shownV15)],
    ['no mask anywhere', noMask(SCENE), noMask(SCENE)],
    ['  fixture v0.15 masked trail must FAIL', '<use mask=...>', !noMask('<use href="#tp" class="trail" mask="url(#trailmask)"/>')],
    ['dots laid at fixed 7 u steps', laid(trailQ), laid(trailQ)],
    ['  fixture v0.15 sliding window must FAIL', 'unquantised', !laid(sAt.map(v => v - GAP_BEHIND))],
    ['no dot ahead of the sting', neverAhead(trailQ), neverAhead(trailQ)],
    ['  fixture sampled at step END must FAIL', 'end-sampled', !neverAhead(quant(stepEnd))],
    ['mean lag newest dot to sting u (<= 13)', lag, lag <= 13],
    ['  fixture 2 Hz offsets must FAIL', lag2Hz, !(lag2Hz <= 13)],
    ['dark fireflies hidden AND not displayed (every glow key)', visOk(SCENE), visOk(SCENE)],
    ['  fixture v0.15 keys must FAIL', 'no visibility', !visOk(kfV15)],
    ['  fixture v0.16 keys must FAIL', 'no display', !visOk(kfV16)],
    ['one clock: no SMIL display/visibility/opacity switch', oneClock(SCENE), oneClock(SCENE)],
    ['  fixture v0.16 light use must FAIL', 'SMIL display animate', !oneClock(v16Use)],
  )
  // v0.17.1 bee tempo: the bee and its trail are four animations; they must share ONE duration (else the
  // dots leave the sting), and the cruise speed as PLAYED must be the faster one chosen in v0.17.1
  const beeDurs = s => { const a = s.slice(s.indexOf('<g class="trail">')); return [...a.matchAll(/<animate(?:Motion|Transform)? [^>]*?dur="([\d.]+)s"/g)].map(m => m[1]) }
  const oneDur = d => d.length === 4 && new Set(d).size === 1
  const cruiseV = SIM.filter(q => q.mode === 'cruise').map(q => q.v).sort((a, b) => a - b)
  const medV = cruiseV[cruiseV.length >> 1]
  const playedV = dur => medV * DUR / dur, fastOk = v => v >= 105 && v <= 125
  const durs = beeDurs(SCENE), splitDurs = [DUR.toFixed(2), ...durs.slice(1)]
  spec.push(
    ['bee and trail on ONE duration (4 animations)', durs.join(' '), oneDur(durs)],
    ['  fixture trail left at the simulated duration must FAIL', splitDurs.join(' '), !oneDur(splitDurs)],
    ['median cruise speed as played, u/s (105-125)', playedV(+durs[0]), fastOk(playedV(+durs[0]))],
    ['  fixture v0.17.0 tempo 1 must FAIL', playedV(DUR), !fastOk(playedV(DUR))],
  )
  // v0.16.1 light: no filter region over ffnear's 48 x 48 u (the full bloom's is 220 x 140, run per lit firefly)
  const filterAreas = s => [...s.matchAll(/<filter\b[^>]*\swidth="([\d.]+)"[^>]*\sheight="([\d.]+)"/g)].map(m => +m[1] * +m[2])
  const smallFilters = s => filterAreas(s).length > 0 && filterAreas(s).every(a => a <= 48 * 48)
  spec.push(
    ['light filters small (largest region, u^2, <= 2304)', Math.max(0, ...filterAreas(SCENE)), smallFilters(SCENE)],
    ['  fixture the full bloom filter must FAIL', '220 x 140', !smallFilters('<filter id="ffbloom" filterUnits="userSpaceOnUse" x="-110" y="-70" width="220" height="140">')],
  )
  // the display switch, judged against the glow itself sampled every 10 ms: the light must be
  // displayed wherever the glow is above zero, and off at least half the time (else no saving)
  const dispAt = ({ kt, vals }, t) => { const u = t / LOOP; let j = 0; while (j + 1 < kt.length && kt[j + 1] <= u) j++; return vals[j] }
  const covers = (i, spans) => { const d = dispKeys(spans), G = flyKeys[i].glow; let bad = 0, off = 0, n = 0; for (let t = 0; t < LOOP; t += 0.01) { const s = dispAt(d, t); if (keyVal(G, t) > 0.001 && s !== 'inline') bad++; if (s === 'none') off++; n++ } return { bad, off: off / n } }
  // v0.17: the switch IS the keyframes: displayed on every segment with a non-zero end, no pad
  const kfSpans = i => { const G = flyKeys[i].glow, out = []; for (let k = 0; k < G.length - 1; k++) if (+G[k][1].toFixed(2) > 0 || +G[k + 1][1].toFixed(2) > 0) { if (out.length && G[k][0] <= out.at(-1)[1]) out.at(-1)[1] = G[k + 1][0]; else out.push([G[k][0], G[k + 1][0]]) } return out }
  const cov = flies.map((_, i) => covers(i, kfSpans(i)))
  const covLate = flies.map((_, i) => covers(i, kfSpans(i).map(([a, b]) => [Math.min(LOOP, a + 0.6), Math.min(LOOP, b + 0.6)])))
  const okCov = c => c.every(x => x.bad === 0 && x.off >= 0.5)
  spec.push(
    ['light displayed wherever it glows; off share (min)', +Math.min(...cov.map(c => c.off)).toFixed(3), okCov(cov)],
    ['  fixture switch 0.6 s late must FAIL', `${covLate.reduce((n, c) => n + c.bad, 0)} dark-but-glowing samples`, !okCov(covLate)],
  )
}
if (SCENE.length > SCENE_MAX) throw new Error(`scene is ${SCENE.length} chars, over its ${SCENE_MAX} share of the app's 131072 limit`)
if (!/<animateMotion[^>]*calcMode="linear"[^>]*values=/.test(SCENE)) throw new Error('bee animateMotion must be calcMode=linear')
if ((SCENE.match(/<animateMotion /g) || []).length !== (SCENE.match(/<animateMotion [^>]*calcMode="linear"/g) || []).length) throw new Error('every animateMotion with values must be calcMode=linear')
const styleBody = SCENE.slice(SCENE.indexOf('<style>') + 7, SCENE.indexOf('</style>'))
if (/[<>&]/.test(styleBody)) throw new Error('style block contains < > or & - not valid XML text')
if (/--/.test(SCENE.replace(/<style>[\s\S]*?<\/style>/, '').replace(/style="[^"]*"/g, '').replace(/<!--|-->/g, '').match(/<!--[\s\S]*?-->/g)?.join('') || '')) throw new Error('-- inside an XML comment')
if (SCENE.length > 131072) throw new Error(`scene is ${SCENE.length} chars, over the 131,072 limit`)
console.log(`seed ${SEED}  chars ${SCENE.length}  cycle ${PLAY.toFixed(1)} s (simulated ${DUR.toFixed(1)} s, tempo ${BEE_TEMPO})  route ${TL.toFixed(0)} u  facing keys ${fk.length}`)
let fails = 0
for (const [k, v, ok] of spec) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${k}: ${typeof v === 'number' ? +v.toFixed(3) : v}`); if (!ok) fails++ }
if (fails) { console.log(`SPEC FAILED (${fails})`); process.exitCode = 2 }
writeFileSync(process.argv[2], header + 'export const SCENE = `' + SCENE + '`\n', 'utf8')

if (process.argv[3]) {
  const sheet = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-15 -9 44 18" width="1760" height="720">
  <style>${styleBody} .flight, .fdraw, .jst { animation: none; opacity: 1 }</style>
  <defs>${SCENE.slice(SCENE.indexOf('<defs>') + 6, SCENE.indexOf('</defs>'))}</defs>
  <rect x="-15" y="-9" width="44" height="18" fill="url(#base)"/>
  <use href="#bee-art"/>
  <g transform="translate(22 0)"><g class="fdraw"><use href="#ffdraw"/></g><g class="flylight"><g class="flight"><use href="#fflight"/></g></g></g>
</svg>`
  writeFileSync(process.argv[3], sheet, 'utf8')
}
if (process.argv[4]) {
  writeFileSync(process.argv[4], SCENE.replace('</svg>', `<path d="${TRAIL_D}" fill="none" stroke="red" stroke-width="1.2" stroke-opacity=".75"/>` +
    flies.map(f => `<path d="M${f.pts.map(p => `${n1(p.x)} ${n1(p.y)}`).join('L')}" fill="none" stroke="#0a0" stroke-width="1" stroke-opacity=".6"/>`).join('') +
    `<rect x="0" y="63" width="1600" height="874" fill="none" stroke="#000" stroke-dasharray="6 6"/></svg>`), 'utf8')
}
