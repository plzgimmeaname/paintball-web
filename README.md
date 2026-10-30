# Paintball Arena

A 2-player paintball platform fighter that runs in the browser. Play on one keyboard, against the CPU, or online with a friend using a 5-letter join code.

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

Online rooms run through a [Firebase Realtime Database](https://firebase.google.com/docs/database). The host's browser runs the match and streams it to the guest through the database, so there's no game server to deploy.

### Firebase setup (one time)

1. Create a project at https://console.firebase.google.com.
2. **Build → Authentication → Sign-in method**: enable **Anonymous**.
3. **Build → Realtime Database**: create a database (locked mode is fine).
4. In the database's **Rules** tab, paste the contents of `database.rules.json` and publish. Or, with the Firebase CLI: `firebase deploy --only database`.
5. **Project settings → Your apps**: add a web app and copy its config values into `src/firebase-config.js`. Make sure `databaseURL` is filled in.
6. If you host on GitHub Pages, add `<your-username>.github.io` under **Authentication → Settings → Authorized domains**.

The config values are public by design. The database rules only let a room's host change the room, and only let the current guest send moves into it. Rooms are deleted automatically when the host leaves or closes the tab.

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
src/net.js      firebase join-code rooms
src/firebase-config.js  your firebase web app config
src/audio.js    synthesized sound effects
src/data.js     arenas (dictionary), weapons (list), cpu difficulty levels
database.rules.json  firebase realtime database security rules
```
