/* Flight renderer using the public demo plane frames; sources: reference/plane-assets.json. */
(() => {
  'use strict';
  const defaults = {
    climbSeconds: 8, glideSeconds: 4, marginLeft: 21, marginBottom: 7,
    lineWidth: 4, color: '#f00b3e', fillOpacity: .5, planeScale: 1,
    propellerFps: 7.5, flyAwaySeconds: .5, growthRate: .075,
  };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const easeInOut = t => t < .5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
  const easeOut = t => 1 - (1 - t) * (1 - t);
  const colors = [[52,180,255], [145,62,248], [192,23,180]];
  class FlightRenderer {
    constructor(svg, options = {}) {
      this.svg = svg;
      this.options = { ...defaults, ...options };
      const o = this.options;
      Object.keys(defaults).forEach(key => {
        if (typeof defaults[key] === 'number' && !Number.isFinite(o[key])) o[key] = defaults[key];
      });
      o.climbSeconds = Math.max(.1, o.climbSeconds);
      o.glideSeconds = Math.max(.1, o.glideSeconds);
      o.growthRate = Math.max(.001, o.growthRate);
      o.flyAwaySeconds = Math.max(0, o.flyAwaySeconds);
      o.planeScale = clamp(o.planeScale, .2, 2);
      o.fillOpacity = clamp(o.fillOpacity, 0, 1);
      o.propellerFps = Math.max(0, o.propellerFps);
      this.aspect = 1;
      this.rayAngle = -92.5;
      this.spriteTime = 0;
      this.spriteFrame = 0;
      svg.innerHTML = `
        <defs>
          <filter id="flightGlowBlur" x="-600" y="-600" width="2200" height="1700" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
            <feGaussianBlur stdDeviation="114.155 74.85"/>
          </filter>
        </defs>
        <ellipse id="backgroundGlow" cx="500" cy="250" rx="244.292" ry="67.365" filter="url(#flightGlowBlur)" fill="#34b4ff" opacity="0"/>
        <path id="curveFill" fill="#d0021b"/>
        <path id="curve" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <g id="plane" opacity="0">
          <g id="planeShape" transform="translate(-21,-66.6)" data-frame="0">
            ${[0,1,2,3].map(index => `<image width="150" height="74" href="assets/plane/plane-${index}.svg" preserveAspectRatio="none" visibility="${index === 0 ? 'visible' : 'hidden'}"/>`).join('')}
          </g>
        </g>`;
      this.curve = svg.querySelector('#curve');
      this.glow = svg.querySelector('#backgroundGlow');
      this.fill = svg.querySelector('#curveFill');
      this.plane = svg.querySelector('#plane');
      this.planeShape = svg.querySelector('#planeShape');
      this.planeFrames = [...this.planeShape.querySelectorAll('image')];
      this.stage = svg.closest('.flightStage');
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      svg.style.setProperty('--flight-color', o.color);
      this.curve.setAttribute('stroke', o.color);
      this.curve.setAttribute('stroke-width', Math.max(0, o.lineWidth));
      this.fill.setAttribute('opacity', o.fillOpacity);
      this.resize = () => {
        const bounds = svg.getBoundingClientRect();
        // Counteract the stretched viewBox so the aircraft keeps its proportions.
        if (bounds.width && bounds.height) {
          this.aspect = (bounds.height / 500) / (bounds.width / 1000);
          this.viewWidth = bounds.width;
          this.viewHeight = bounds.height;
          // The public client sizes its 150 x 74 aircraft from the arena width.
          const scale = clamp(bounds.width / 900, .65, 1) * o.planeScale;
          this.renderScale = scale * 500 / bounds.height;
          const aircraftWidth = 150 * scale, aircraftHeight = 74 * scale;
          const x = px => px * 1000 / bounds.width, y = px => px * 500 / bounds.height;
          this.start = { x: x(o.marginLeft), y: y(bounds.height - o.marginBottom) };
          this.mount = { x: x(Math.max(0, bounds.width - aircraftWidth * 1.5)), y: y(Math.min(bounds.height, aircraftHeight)) };
          this.glide = { x: x(Math.max(0, bounds.width - aircraftWidth)), y: y(Math.min(bounds.height, aircraftHeight * 3)) };
        }
      };
      this.resize();
      if (typeof ResizeObserver !== 'undefined') {
        this.observer = new ResizeObserver(this.resize);
        this.observer.observe(svg);
      }
      this.beginRound();
    }
    beginRound() {
      // Rotation resumes from the previous round, as in the reference client.
      this.rayOffset = this.rayAngle;
      // Keep the propeller's sequence continuous across round boundaries.
      this.spritePhase = 'waiting';
      this.spriteClock = 0;
    }
    point(seconds) {
      const o = this.options;
      const time = Math.max(0, seconds);
      if (time <= o.climbSeconds) {
        const progress = time / o.climbSeconds;
        return {
          x: this.start.x + (this.mount.x - this.start.x) * easeOut(progress),
          y: this.start.y + (this.mount.y - this.start.y) * easeInOut(progress),
        };
      }
      const cycle = (time - o.climbSeconds) / o.glideSeconds % 2;
      const glide = easeInOut(cycle <= 1 ? cycle : 2 - cycle);
      return {
        x: this.mount.x + (this.glide.x - this.mount.x) * glide,
        y: this.mount.y + (this.glide.y - this.mount.y) * glide,
      };
    }
    draw(seconds, phase = 'flying', exitSeconds = 0, multiplier) {
      const o = this.options, time = Math.max(0, seconds);
      if (this.stage) {
        const rotationTime = phase === 'waiting' ? 0 : time;
        if (this.reducedMotion.matches) this.rayOffset = this.rayAngle - rotationTime * 10;
        else this.rayAngle = this.rayOffset + rotationTime * 10;
        this.stage.style.setProperty('--ray-angle', `${this.rayAngle}deg`);
      }
      const value = Number.isFinite(multiplier) ? multiplier : Math.exp(o.growthRate * time);
      const band = value >= 10 ? 2 : value >= 2 ? 1 : 0;
      const blendTime = band ? Math.log(value / (band === 2 ? 10 : 2)) / o.growthRate : 0;
      const blend = this.reducedMotion.matches ? 1 : easeOut(clamp(blendTime / .5, 0, 1));
      const previous = colors[Math.max(0, band - 1)], target = colors[band];
      const tint = target.map((channel, i) => Math.round(previous[i] + (channel - previous[i]) * blend));
      this.glow.setAttribute('fill', `rgb(${tint.join(',')})`);
      const fadeIn = easeOut(clamp(time, 0, 1));
      const alpha = phase === 'waiting' ? 0 : phase === 'crashed' ? fadeIn * (1 - easeOut(clamp(exitSeconds, 0, 1))) : fadeIn;
      this.glow.setAttribute('opacity', this.reducedMotion.matches ? (phase === 'flying' ? 1 : 0) : alpha);
      const point = this.point(time);
      // One quadratic curve is redrawn through the current endpoint. It is not
      // a historical trace: the complete arc settles as the aircraft glides down.
      const path = `M0,500 Q${point.x / 2},500 ${point.x},${point.y}`;
      this.curve.setAttribute('d', phase === 'flying' ? path : '');
      this.fill.setAttribute('d', phase === 'flying' ? `${path} L${point.x},500 L0,500 Z` : '');
      const exit = phase === 'crashed' ? (o.flyAwaySeconds ? clamp(exitSeconds / o.flyAwaySeconds, 0, 1) : 1) : 0;
      const exitX = 1000 + 150 * 1000 / this.viewWidth;
      const exitY = 200 * 500 / this.viewHeight;
      this.plane.setAttribute('transform', `translate(${point.x + exit * (exitX - point.x)},${point.y - exit * exitY}) scale(${this.aspect},1) scale(${this.renderScale})`);
      this.plane.setAttribute('opacity', exit >= 1 ? 0 : 1);
      // Original sequence: 0, 1, 2, 3 (frame 3 repeats frame 1).
      // The public client's .125 frames per 60-Hz tick equals 7.5 frames/sec.
      const clock = phase === 'waiting' ? Math.max(0, exitSeconds) : time + (phase === 'crashed' ? exitSeconds : 0);
      if (phase === this.spritePhase) this.spriteTime += Math.max(0, clock - this.spriteClock);
      else this.spriteTime += phase === 'flying' ? time : phase === 'crashed' ? exitSeconds : 0;
      this.spritePhase = phase;
      this.spriteClock = clock;
      const frame = this.reducedMotion.matches ? 0 : Math.floor(this.spriteTime * o.propellerFps + 1e-7) % this.planeFrames.length;
      if (frame !== this.spriteFrame) {
        this.planeFrames.forEach((image, index) => image.setAttribute('visibility', index === frame ? 'visible' : 'hidden'));
        this.planeShape.dataset.frame = String(frame);
        this.spriteFrame = frame;
      }
    }
  }
  window.FlightRenderer = FlightRenderer;
})();

