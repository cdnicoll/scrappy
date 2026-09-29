// Draws the menu bar template icon: a note outline with three text lines.
import { Buffer } from 'node:buffer'
import { deflateSync, crc32 } from 'node:zlib'
import { writeFileSync } from 'node:fs'

function png(size, alphaAt) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      raw[y * (size * 4 + 1) + 1 + x * 4 + 3] = alphaAt(x, y)
    }
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data])
    const out = Buffer.alloc(8 + body.length)
    out.writeUInt32BE(data.length, 0)
    body.copy(out, 4)
    out.writeUInt32BE(crc32(body) >>> 0, 4 + body.length)
    return out
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 6, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Shape in a 16 unit grid, sampled 4x4 per pixel for smooth edges.
function inside(u, v) {
  const inRound = (x0, y0, x1, y1, r) => {
    if (u < x0 || u > x1 || v < y0 || v > y1) return false
    const cx = Math.min(Math.max(u, x0 + r), x1 - r)
    const cy = Math.min(Math.max(v, y0 + r), y1 - r)
    return (u - cx) ** 2 + (v - cy) ** 2 <= r * r
  }
  const outline = inRound(2, 1.5, 14, 14.5, 2.2) && !inRound(3.3, 2.8, 12.7, 13.2, 1.2)
  const line = (y, x1) => u >= 5 && u <= x1 && v >= y && v <= y + 1.2
  return outline || line(5.2, 11) || line(7.6, 11) || line(10, 8.5)
}

for (const [size, name] of [[16, 'iconTemplate.png'], [32, 'iconTemplate@2x.png']]) {
  const data = png(size, (x, y) => {
    let hits = 0
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      if (inside(((x + (i + 0.5) / 4) / size) * 16, ((y + (j + 0.5) / 4) / size) * 16)) hits++
    }
    return Math.round((hits / 16) * 255)
  })
  writeFileSync(`resources/${name}`, data)
}
