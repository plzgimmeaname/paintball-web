# Paintball Arena

A 2-player paintball platform fighter that runs in the browser. Play on one keyboard, against the CPU, or online with a friend using a 5-letter join code.

## Play it on GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repo, open **Settings → Pages**.
3. Under **Build and deployment**, pick **Deploy from a branch**, choose `main` and `/ (root)`, then save.
4. After a minute the game is live at `https://<your-username>.github.io/<repo-name>/`.

There's no build step. The site is plain HTML, CSS and JavaScript modules.

## Run it locally

ES modules don't load from `file://`, so serve the folder:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Online play

- One player clicks **Host Online** and shares the join code (or the invite link).
- The other clicks **Join Online** and types the code.
- The host picks the arena and round count. Each player picks their own weapon.

The connection is peer-to-peer over WebRTC using [PeerJS](https://peerjs.com). Its free public broker only introduces the two browsers to each other, so you don't need a server. The host's browser runs the match and streams it to the guest. A few strict networks (some school or corporate Wi-Fi) block peer-to-peer connections. If joining keeps failing, try a different network.

## Controls

| | Move | Jump (tap twice to double jump) | Shoot |
|---|---|---|---|
| Player 1 (red) | `A` `D` | `W` | `S` or `Space` |
| Player 2 (blue) | `←` `→` | `↑` | `↓` or `Enter` |

Against the CPU or online, either set of keys works. `Esc` pauses. The CPU comes in Easy, Normal and Hard, picked in match setup.

## Project layout

```
index.html      page + menus
style.css       ui styling
src/main.js     ui flow, input, game loop, online session
src/sim.js      game rules and physics (fixed 60 ticks/sec)
src/render.js   canvas drawing: arenas, characters, paint, hud
src/bot.js      cpu opponent
src/net.js      peerjs join-code networking
src/audio.js    synthesized sound effects
src/data.js     arenas (dictionary), weapons (list), cpu difficulty levels
```
