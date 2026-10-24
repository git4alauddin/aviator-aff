# Animation reference

Verified on 24 October 2026 from the official demo's publicly served client, version v4.2.116-hotfix-3. These are behavior measurements from the animation definitions, not claims based on watching a gameplay recording.

Sources: [SPRIBE product page](https://www.spribe.co/games/aviator), [public demo launcher](https://demo.spribe.io/launch/aviator?currency=USD&lang=EN), [client build inspected](https://aviator-demo.spribegaming.com/main.41c3b83d282727f1.js).

The initial climb lasts eight seconds. Horizontal travel slows toward its destination, while vertical travel eases in and out. The plane then glides toward a lower point over four seconds and returns over four seconds, repeating smoothly. The orientation stays fixed. The full quadratic arc reshapes with its endpoint; it is not a record of the plane's past positions.

The central glow stays blue below 2x, blends to purple at 2x, and blends to magenta at 10x. Color blends last half a second. Glow fade-in and fade-out last one second. The rays turn once every 36 seconds, stop at the round's end, and resume from the same orientation on the next flight.

On fly-away the curve and fill clear immediately. The plane exits linearly over half a second, aiming 200 screen pixels upward and beyond the right edge.

The JSON contains independently calculated pixel positions for desktop and mobile arenas, used as fixtures by verify-ui.cjs. No downloaded client JavaScript is bundled with the local page. The shell remains a calibrated visual simulation.

The final aircraft uses the public demo's original plane-0.svg through plane-3.svg files, downloaded unchanged into assets/plane. They are 150 × 74 pixels, use the source color #E50539, and are anchored at 14% across and 90% down. The verified animationSpeed value of 0.125 per 60-Hz tick corresponds to 7.5 frames per second. Frame 3 is byte-identical to frame 1; this repeated intermediate pose is preserved. The original asset sequence supplies the blade movement without an added artificial blur or extra rotation.

Source URLs and SHA-256 hashes are recorded in plane-assets.json. The four-frame visual sheet is available at ../preview/plane-frames.html and ../preview/plane-frames.png. These assets originate from SPRIBE's public demo; the project does not claim authorship of them.
