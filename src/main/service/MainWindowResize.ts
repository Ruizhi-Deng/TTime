import type { BrowserWindow, Point, Rectangle } from 'electron'

const MIN_WIDTH = 450
const MIN_HEIGHT = 150

/** Keeps automatic content sizing until the user chooses a window height. */
export class MainWindowResize {
  private manualHeight = false
  private drag: { bounds: Rectangle; cursor: Point } | undefined

  constructor(
    private win: BrowserWindow,
    private getCursor: () => Point,
    private saveWidth: (width: number) => void
  ) {
    win.setMinimumSize(MIN_WIDTH, MIN_HEIGHT)
    win.on('will-resize', (_event, bounds) => {
      if (bounds.height !== win.getBounds().height) this.manualHeight = true
      this.saveWidth(bounds.width)
    })
    win.on('resize', () => this.notify())
    win.on('hide', () => this.end())
    win.on('blur', () => this.end())
    win.on('closed', () => {
      this.drag = undefined
    })
  }

  autoHeight(height: number): void {
    if (this.manualHeight || this.drag || !Number.isFinite(height)) return
    const bounds = this.win.getBounds()
    const nextHeight = Math.max(MIN_HEIGHT, Math.round(height))
    // Typing repeatedly requests the same maximum height. Avoid a native resize
    // unless the height changes, and keep the pre-resize origin as the anchor.
    if (bounds.height === nextHeight) return
    const target = { ...bounds, height: nextHeight }
    this.win.setBounds(target)

    // Windows frameless bounds and fractional DPI can report a shifted origin
    // or rounded-up size. Correct once against the original target, so another
    // content update cannot adopt that shift and accumulate position drift.
    const actual = this.win.getBounds()
    if (
      actual.x !== target.x || actual.y !== target.y ||
      actual.width > target.width || actual.height > target.height
    ) {
      this.win.setBounds({
        x: target.x + (target.x - actual.x),
        y: target.y + (target.y - actual.y),
        width: Math.max(MIN_WIDTH, target.width - Math.max(0, actual.width - target.width)),
        height: Math.max(MIN_HEIGHT, target.height - Math.max(0, actual.height - target.height))
      })
    }
  }

  start(): void {
    // Electron's screen API uses DIP coordinates, including on scaled displays.
    this.drag = { bounds: this.win.getBounds(), cursor: this.getCursor() }
  }

  move(): void {
    if (!this.drag) return
    const { bounds, cursor } = this.drag
    const current = this.getCursor()
    const width = Math.max(MIN_WIDTH, bounds.width + current.x - cursor.x)
    const height = Math.max(MIN_HEIGHT, bounds.height + current.y - cursor.y)
    const actual = this.win.getBounds()
    if (width === actual.width && height === actual.height) return
    if (height !== bounds.height) this.manualHeight = true
    this.win.setBounds({ ...bounds, width, height })
  }

  end(): void {
    if (!this.drag) return
    this.drag = undefined
    if (!this.win.isDestroyed()) this.saveWidth(this.win.getSize()[0])
  }

  private notify(): void {
    this.win.webContents.send('win-size-update', {
      ...this.win.getBounds(),
      manualHeight: this.manualHeight
    })
  }
}
