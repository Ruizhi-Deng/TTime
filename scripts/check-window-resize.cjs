const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { buildSync } = require('esbuild')
const vm = require('node:vm')

const moduleObject = { exports: {} }
vm.runInNewContext(buildSync({
  entryPoints: ['src/main/service/MainWindowResize.ts'],
  bundle: true, write: false, platform: 'node', format: 'cjs'
}).outputFiles[0].text, { module: moduleObject, exports: moduleObject.exports })
const { MainWindowResize } = moduleObject.exports

class Window extends EventEmitter {
  bounds = { x: -800, y: 50, width: 600, height: 722 }
  messages = []
  webContents = { send: (channel, data) => this.messages.push({ channel, data }) }
  getBounds() { return { ...this.bounds } }
  getSize() { return [this.bounds.width, this.bounds.height] }
  setMinimumSize(width, height) { this.minimum = [width, height] }
  setSize(width, height) { this.setBounds({ ...this.bounds, width, height }) }
  setBounds(bounds) { this.bounds = { ...bounds }; this.emit('resize') }
  isDestroyed() { return false }
}

function setup() {
  const win = new Window()
  let cursor = { x: -200, y: 772 }
  const widths = []
  const sizing = new MainWindowResize(win, () => cursor, (width) => widths.push(width))
  return { win, sizing, widths, cursor: (x, y) => { cursor = { x, y } } }
}

// A long result must not lock the minimum height to its content height.
const a = setup()
assert.deepEqual(a.win.minimum, [450, 150])
a.sizing.autoHeight(722)
a.sizing.start()
a.cursor(-350, 400)
a.sizing.move()
assert.deepEqual(a.win.getBounds(), { x: -800, y: 50, width: 450, height: 350 })
assert.equal(a.win.messages.at(-1).data.manualHeight, true)
a.sizing.end()
assert.deepEqual(a.widths, [450])
// Both queued height updates and later stream updates must respect the user height.
a.sizing.autoHeight(722)
a.sizing.autoHeight(500)
assert.equal(a.win.getSize()[1], 350)
a.sizing.start()
a.cursor(0, 900)
a.sizing.move()
a.sizing.end()
assert.deepEqual(a.win.getSize(), [800, 850])

// Width-only resizing retains content height adaptation.
const b = setup()
b.sizing.start()
b.cursor(0, 772)
b.sizing.move()
b.sizing.autoHeight(400)
assert.deepEqual(b.win.getSize(), [800, 722])
b.sizing.end()
b.sizing.autoHeight(400)
assert.deepEqual(b.win.getSize(), [800, 400])
b.sizing.autoHeight(100)
assert.equal(b.win.getSize()[1], 150)
b.sizing.autoHeight(NaN)
assert.equal(b.win.getSize()[1], 150)

// A click without movement leaves automatic sizing active.
const c = setup()
c.sizing.start()
c.sizing.end()
c.sizing.autoHeight(400)
assert.equal(c.win.getSize()[1], 400)

// Native edge drags can change height; blur/hide stop custom drags.
for (const event of ['blur', 'hide']) {
  const d = setup()
  d.sizing.start()
  d.win.emit(event)
  d.cursor(0, 900)
  d.sizing.move()
  assert.deepEqual(d.win.getSize(), [600, 722])
}
const e = setup()
let prevented = false
const nativeBounds = { ...e.win.getBounds(), height: 500 }
e.win.emit('will-resize', { preventDefault() { prevented = true } }, nativeBounds)
assert.equal(prevented, false)
e.win.setBounds(nativeBounds)
e.sizing.autoHeight(722)
assert.equal(e.win.getSize()[1], 500)
assert.equal(e.win.messages.at(-1).data.manualHeight, true)

// Windows fractional DPI rounding must not grow the width on each content update.
const f = setup()
f.win.setBounds = function(bounds) {
  this.bounds = { ...bounds, width: bounds.width + 1 }
  this.emit('resize')
}
f.sizing.autoHeight(500)
f.sizing.autoHeight(600)
assert.deepEqual(f.win.getSize(), [600, 600])

// Reproduce native bounds drift even when setBounds gets explicit x/y.
// Twenty typing/stream updates must leave the original top-left corner fixed.
for (const origin of [{ x: 600, y: 200 }, { x: -800, y: 50 }]) {
  const g = setup()
  g.win.bounds = { ...g.win.bounds, ...origin }
  let nativeUpdates = 0
  g.win.setBounds = function(bounds) {
    nativeUpdates++
    this.bounds = {
      ...bounds, x: bounds.x - 8, y: bounds.y - 8,
      width: bounds.width + 1, height: bounds.height + 1
    }
    this.emit('resize')
  }
  for (let i = 0; i < 20; i++) {
    const height = i % 2 ? 500 : 722
    g.sizing.autoHeight(height)
    assert.deepEqual(g.win.getBounds(), { ...origin, width: 600, height })
  }
  const beforeRepeatedTyping = nativeUpdates
  for (let i = 0; i < 100; i++) g.sizing.autoHeight(500)
  assert.equal(nativeUpdates, beforeRepeatedTyping)
  assert.ok(nativeUpdates <= 40)
  // A deliberate user move becomes the new anchor for later content updates.
  g.win.bounds = { ...g.win.bounds, x: origin.x + 100, y: origin.y + 50 }
  g.sizing.autoHeight(600)
  assert.deepEqual(g.win.getBounds(), {
    x: origin.x + 100, y: origin.y + 50, width: 600, height: 600
  })
}

console.log('Window resize checks passed')
