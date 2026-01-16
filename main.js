const { app, BrowserWindow, ipcMain, screen } = require('electron');

let bubble;
let chat;
let isExpanded = false;
let lastBounds = null;

function createBubble() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;

  bubble = new BrowserWindow({
    skipTaskbar: true,
    width: 60,
    height: 60,
    x: workArea.x + workArea.width - 80, // 60 width + 20 padding
    y: workArea.y + workArea.height - 80, // 60 height + 20 padding
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  bubble.loadFile('bubble.html');

  // initialize lastBounds
  lastBounds = bubble.getBounds();
}

app.whenReady().then(createBubble);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('log', (event, message) => {
  console.log(message);
});

ipcMain.on('move-bubble', (event, { x, y }) => {
  if (!bubble) return;

  // Get current window size so we can clamp properly
  const { width, height } = bubble.getBounds();

  // Pick the display nearest to the intended position (center of the window)
  const display = screen.getDisplayNearestPoint({ x: Math.round(x + width / 2), y: Math.round(y + height / 2) }) || screen.getPrimaryDisplay();
  const { workArea } = display;

  // Compute clamped coordinates so the window stays fully inside the workArea (not under taskbar)
  const minX = workArea.x;
  const minY = workArea.y;
  const maxX = workArea.x + workArea.width - width;
  const maxY = workArea.y + workArea.height - height;

  const newX = Math.round(Math.max(minX, Math.min(x, maxX)));
  const newY = Math.round(Math.max(minY, Math.min(y, maxY)));

  bubble.setPosition(newX, newY);

  // Update last known bounds
  lastBounds = bubble.getBounds();
});


ipcMain.on('resize-bubble', (event, expanded) => {
  if (!bubble) return;

  // (display chosen later based on bubble bounds)

  // Small bubble size
  const small = { width: 60, height: 60 };
  const big = { width: 320, height: 420 };

  const newSize = expanded ? big : small;

  // Current position and size
  const sourceBounds = lastBounds || bubble.getBounds();
  const { x: oldX, y: oldY, width: oldW, height: oldH } = sourceBounds;

  // Compute from bottom-right to avoid accidental off-by-one with width/height
  const bottomRightX = oldX + oldW;
  const bottomRightY = oldY + oldH;

  // Anchor bottom-right: move top-left so bottom-right stays in place
  let newX = bottomRightX - newSize.width;
  let newY = bottomRightY - newSize.height;

  // Debug log to help diagnose unexpected jumps
  console.log('resize-bubble:', { expanded, oldX, oldY, oldW, oldH, bottomRightX, bottomRightY, newX, newY });

  // Clamp to screen
  // Choose the display nearest to the bubble's bottom-right (keeps monitor when expanding)
  const display = screen.getDisplayNearestPoint({ x: Math.round(bottomRightX), y: Math.round(bottomRightY) }) || screen.getPrimaryDisplay();
  const { workArea } = display;

  newX = Math.max(workArea.x, Math.min(newX, workArea.x + workArea.width - newSize.width));
  newY = Math.max(workArea.y, Math.min(newY, workArea.y + workArea.height - newSize.height));

  // console.log('resize-bubble clamped:', { newX, newY, workArea: workArea });

  // Ensure programmatic resize is allowed while we set bounds, then restore prior resizable state
  const prevResizable = typeof bubble.isResizable === 'function' ? bubble.isResizable() : false;
  bubble.setResizable(true);

  bubble.setBounds({
    x: Math.round(newX),
    y: Math.round(newY),
    width: newSize.width,
    height: newSize.height
  });

  bubble.setResizable(prevResizable);

  // Track state
  isExpanded = !!expanded;
});
