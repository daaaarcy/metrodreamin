import type * as maplibregl from 'maplibre-gl'

const SIZE = 64

/** Rasterize a shape to a blurred alpha channel so it works as a rough SDF image. */
function rasterize(draw: (ctx: CanvasRenderingContext2D, s: number) => void): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = '#fff'
  ctx.filter = 'blur(4px)'
  draw(ctx, SIZE)
  ctx.filter = 'none'
  draw(ctx, SIZE) // crisp core on top of the blurred halo
  return ctx.getImageData(0, 0, SIZE, SIZE)
}

function circle(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  ctx.arc(s / 2, s / 2, s * 0.3, 0, Math.PI * 2)
  ctx.fill()
}

function diamond(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  ctx.moveTo(s / 2, s * 0.18)
  ctx.lineTo(s * 0.82, s / 2)
  ctx.lineTo(s / 2, s * 0.82)
  ctx.lineTo(s * 0.18, s / 2)
  ctx.closePath()
  ctx.fill()
}

function plus(ctx: CanvasRenderingContext2D, s: number) {
  const w = s * 0.2
  ctx.fillRect(s / 2 - w / 2, s * 0.15, w, s * 0.7)
  ctx.fillRect(s * 0.15, s / 2 - w / 2, s * 0.7, w)
}

function heart(ctx: CanvasRenderingContext2D, s: number) {
  const r = s * 0.17
  const cy = s * 0.42
  ctx.beginPath()
  ctx.arc(s / 2 - r, cy, r, Math.PI, 0)
  ctx.arc(s / 2 + r, cy, r, Math.PI, 0)
  ctx.lineTo(s / 2, s * 0.82)
  ctx.closePath()
  ctx.fill()
}

function star(ctx: CanvasRenderingContext2D, s: number) {
  const cx = s / 2
  const cy = s / 2
  const spikes = 5
  const outer = s * 0.34
  const inner = s * 0.14
  ctx.beginPath()
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (i * Math.PI) / spikes - Math.PI / 2
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
}

function cross(ctx: CanvasRenderingContext2D, s: number) {
  const w = s * 0.14
  ctx.save()
  ctx.translate(s / 2, s / 2)
  ctx.rotate(Math.PI / 4)
  ctx.fillRect(-s * 0.35, -w / 2, s * 0.7, w)
  ctx.fillRect(-w / 2, -s * 0.35, w, s * 0.7)
  ctx.restore()
}

export const LINE_ICON_NAMES = ['circle', 'diamond', 'plus', 'heart', 'star'] as const
export const WAYPOINT_ICON = 'mdx'
export const lineIconImageId = (icon: string) => `mdi-${icon}`

const DRAWERS: Record<string, (ctx: CanvasRenderingContext2D, s: number) => void> = {
  [lineIconImageId('circle')]: circle,
  [lineIconImageId('diamond')]: diamond,
  [lineIconImageId('plus')]: plus,
  [lineIconImageId('heart')]: heart,
  [lineIconImageId('star')]: star,
  [WAYPOINT_ICON]: cross,
}

/** Register all SDF icons on the map (idempotent). */
export function ensureIcons(map: maplibregl.Map) {
  for (const [name, draw] of Object.entries(DRAWERS)) {
    if (!map.hasImage(name)) {
      map.addImage(name, rasterize(draw), { sdf: true })
    }
  }
}
