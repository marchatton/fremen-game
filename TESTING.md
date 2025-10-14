# Manual Testing Guide - VS1

## Setup

```bash
# Terminal 1 - Start server
cd apps/server
cp .env.example .env
pnpm run dev

# Terminal 2 - Start client
cd apps/client
cp .env.example .env
pnpm run dev
```

## Test Checklist

### 1. Basic Connection
- [ ] Open http://localhost:5173 in browser
- [ ] Client should connect to server
- [ ] Console should show "Welcome! Player ID: [uuid]"
- [ ] Server console should show player joined

### 2. Player Movement
- [ ] Click on canvas to lock pointer
- [ ] Press **WASD** to move
- [ ] Move mouse to look around
- [ ] Character (blue capsule) should move smoothly
- [ ] FPS counter should show ~60fps

### 3. Camera Controls
- [ ] Press **C** to toggle debug camera
- [ ] In debug mode: drag to orbit, scroll to zoom
- [ ] Press **C** again to return to follow camera

### 4. Terrain
- [ ] Terrain should be visible (sandy color)
- [ ] Walk around - new chunks should load
- [ ] Terrain should have hills/valleys (procedural)
- [ ] Player should stay on terrain surface

### 5. Sandworm
- [ ] Large worm (brown segments) should be visible
- [ ] Worm should patrol smoothly
- [ ] Worm changes direction periodically
- [ ] All clients see same worm position

### 6. Thumper Deployment
- [ ] Press **E** to deploy thumper
- [ ] Thumper appears at your location (gray cylinder, red top)
- [ ] Thumper pulses/glows
- [ ] Worm should change course toward thumper
- [ ] After 60 seconds, thumper disappears
- [ ] You start with 3 thumpers (can deploy 3 times)

### 7. Chat System
- [ ] Press **Enter** to open chat
- [ ] Type a message and press **Enter** to send
- [ ] Message should appear in chat window
- [ ] Press **Esc** to close chat
- [ ] Try sending >1 message/2sec (should be rate limited)

### 8. Multiplayer
- [ ] Open second browser window (http://localhost:5173)
- [ ] Second player (red capsule) should appear
- [ ] Move in one window - other window sees movement
- [ ] Both players see same worm
- [ ] Chat messages visible to both players

### 9. Reconnection
- [ ] Disconnect one client (close tab)
- [ ] Reopen within 5 minutes
- [ ] Player should reconnect to same position
- [ ] State should be preserved

## Known Issues to Check

- [ ] Movement should feel responsive (<150ms lag)
- [ ] No console errors
- [ ] Worm doesn't teleport/jitter
- [ ] Players don't fall through terrain
- [ ] Chat doesn't allow >200 char messages

## Performance Check

- [ ] FPS stays at 60
- [ ] No frame drops when moving
- [ ] Server tick rate stable at 30hz (check server console)
- [ ] Network usage <30 kbps/player (check browser DevTools > Network)

## Success Criteria

✅ All above tests pass
✅ Game feels playable and responsive
✅ No major bugs or crashes
✅ Ready for VS2 development
