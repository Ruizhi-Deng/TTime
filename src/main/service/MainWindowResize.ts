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
    const width = this.win.getSize()[0]
    const nextHeight = Math.max(MIN_HEIGHT, Math.round(height))
    this.win.setSize(width, nextHeight)
    // Preserve the existing workaround for Windows fractional DPI rounding.
    const actualWidth = this.win.getSize()[0]
    if (actualWidth > width) this.win.setSize(width - (actualWidth - width), nextHeight)
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
