# Top-Down Shooter

A simple top-down shooter built with HTML5 Canvas.

## Run

Open `index.html` in your browser, or start a local server:

```bash
npx serve .
# or
python3 -m http.server 8080
```

## Controls

| Action | Input |
|--------|-------|
| Move | WASD / arrow keys |
| Aim | Mouse |
| Shoot | LMB (hold) |
| Restart | R (after game over) |

## Mechanics

- Enemies spawn in waves from the screen edges and chase the player
- Contact with an enemy deals damage
- Each wave adds more enemies — faster and tougher
- Killing enemies earns score (higher multiplier on later waves)
