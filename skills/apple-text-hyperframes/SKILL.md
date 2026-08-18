---
name: apple-text-hyperframes
description: Use when creating Apple-inspired kinetic text HyperFrames videos with masked roll-up text, flat black or contrast backgrounds, sparse copy, and synced sound cues.
source: https://github.com/iharnoor/skillit/blob/main/scripts/seeds/apple-text-hyperframes.json
generated: 2026-07-02T18:41:19.435Z
category: tool
audience: creators
---

## When to use

- Creating Apple-inspired HyperFrames videos with kinetic typography, roll-up text, product-launch pacing, or premium masked text motion
- Using a flat black background with white Apple-style word reveals and no decorative effects
- Improving a HyperFrames cut that needs masked text layers, fast-but-soft easing, motion blur, and contrasty stage lighting
- Building literal straight-line text passes when the user asks for one-axis movement without arcs, bounce, rotation, or background reactions
- Adapting the Apple-style cues reference without copying a source video shot exactly

## Key concepts

### Product-launch sequence

Prefer short 9:16 HyperFrames cuts around 10-18 seconds, with one product or concept name, one short verb phrase, and a few supporting labels.

### Text as layers

Treat text as physical layers in space. Put lines inside overflow-hidden masks; for roll-up text, put each word in its own fixed-width mask on one readable baseline.

### Plain black mode

When the user asks for a black background with no effects, use flat #000 only with white or near-white text. Do not add gradients, glow, grain, glass, scanlines, particles, texture, or light sweeps.

### Roll-up reveal

Use the canonical Apple-style black-background pattern: each word starts below its mask with slight rotationX, rolls upward into place, and settles to y: 0, rotationX: 0, opacity 1, and blur 0.

### Apple-like timing

Use fast intent and soft landing: 0.35-0.7 second reveals, power3.out or expo.out easing, 0.04-0.12 second line staggers, or 0.45-0.65 second word staggers for roll-up text.

### Contrast backgrounds

Use restrained high-contrast stages: near-black with rim light, bright white with dark type, or a saturated product-color field with white type and dark glass overlays.

### Straight-line text pass

Only use this when explicitly requested. Put the full phrase on one line, move it horizontally on a fixed baseline, and use linear timing without stagger, bounce, rotation, scale hits, or background reactions.

### Sound-layer sync

Use minimal synthetic UI sounds such as whooshes, ticks, sub hits, airy reverses, and soft chimes. Place transients on the exact frame where text settles or the mask completes.

### Frame-verified render

After editing, run checks, render, and inspect representative frames for blank scenes, clipped text, low contrast, crowded copy, and audio beats that feel detached from motion.

## API reference

```
Read references/apple-style-cues.md when Apple-style detail is requested
```

Load the reference only when the user asks for Apple-style text animation, the NaughtyyJuan reference, source-video cues, or sound-layer guidance.

```
.text-mask > .text-line
```

Standard DOM structure for masked text reveals in HyperFrames compositions.

```
<div class="text-mask">
  <div class="text-line">Ultra fast</div>
</div>
```

```
.word-mask > .word
```

Standard DOM structure for black-background roll-up phrases with one fixed mask per word.

```
<div class="track">
  <div class="word-mask"><div class="word word-are">Are</div></div>
  <div class="word-mask"><div class="word word-you">you</div></div>
  <div class="word-mask wide"><div class="word word-ready">ready?</div></div>
</div>
```

```
GSAP masked rise reveal
```

Animate text from below an overflow-hidden mask while opacity and blur resolve into a sharp landing.

```
const easeOut = "power3.out";
const hit = { duration: 0.55, ease: easeOut };

tl.from(".text-mask .text-line", {
  yPercent: 110,
  opacity: 0,
  filter: "blur(18px)",
  stagger: 0.07,
  duration: 0.62,
  ease: "expo.out"
}, 0.2).to(".text-mask .text-line", {
  filter: "blur(0px)",
  duration: 0.24,
  stagger: 0.07
}, 0.42);
```

```
Plain black roll-up reveal
```

Use fixed word masks on a flat black background and animate each word vertically through its own mask.

```
gsap.set(".word", { y: 128, rotationX: -68, opacity: 0, filter: "blur(12px)" });

tl.to(".word-are", { y: 0, rotationX: 0, opacity: 1, filter: "blur(0px)", duration: 0.68, ease: "expo.out" }, 0.28)
  .to(".word-you", { y: 0, rotationX: 0, opacity: 1, filter: "blur(0px)", duration: 0.68, ease: "expo.out" }, 0.82)
  .to(".word-ready", { y: 0, rotationX: 0, opacity: 1, filter: "blur(0px)", duration: 0.76, ease: "expo.out" }, 1.38);
```

```
Plain black single-line pass
```

Use a simple horizontal move with no easing when the user explicitly asks for straight-line movement.

```
tl.to(".headline", {
  x: "calc(1080px + 112%)",
  duration: 4.25,
  ease: "none"
}, 0.35);
```

```
Black roll-up CSS baseline
```

Keep word masks on one centered baseline with readable gaps and no background effects.

```
html, body, #root { background: #000; }
.track {
  position: absolute;
  left: 70px;
  right: 70px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  justify-content: center;
  gap: 34px;
  perspective: 900px;
}
.word-mask {
  position: relative;
  width: 236px;
  height: 340px;
  overflow: hidden;
}
.word-mask.wide { width: 454px; }
.word {
  position: absolute;
  left: 0;
  top: 82px;
  color: #fff;
  font-size: 116px;
  line-height: 1;
  font-weight: 760;
  letter-spacing: 0;
  white-space: nowrap;
  transform-origin: 50% 100%;
}
```

```
window.__timelines["main"]
```

Register the main GSAP timeline so HyperFrames can render deterministic animation and audio timing.

```
window.__timelines = window.__timelines || {};
window.__timelines["main"] = gsap.timeline({ paused: true });
```

```
assets/<topic>/audio/
```

Store local sound-design assets with the project topic and follow the project's existing audio convention when present.

```
npm run check && npm run render
```

Validate and render the HyperFrames project, then inspect representative frames and audio/video sync before returning the final MP4.

## Gotchas

- Preserve the active index.html into variants/ before replacing a HyperFrames composition.
- Do not use copyrighted Apple sounds unless the user provides licensed audio; generate or source clean synthetic UI sounds instead.
- When the user asks for plain black or no effects, set html, body, and #root to #000 and remove all decorative background layers.
- For roll-up text, keep each word in a fixed-width mask with readable final spacing so independent word layers do not visually fuse together.
- For straight-line movement, keep motion on one horizontal axis with ease: "none" unless the user asks it to stop centered.
- Keep copy sparse. Apple-style motion falls apart when the frame is crowded with captions or long sentences.
- Keep letter spacing at 0 and use weight, size, contrast, masking, and timing for polish.
- Background motion should be quieter than text motion, with one primary motion direction per beat; omit background motion entirely in explicit minimal modes.
- Avoid low-contrast gray-on-gray type unless the text is very large and still clearly readable.
- Sync sound to impact frames, not scene starts; whooshes usually begin 4-8 frames before visual landing.
- Patch and rerender if preview frames show clipped text, blank frames, low contrast, or text that feels disconnected from audio beats.

---
Generated by SkillMake from https://github.com/iharnoor/skillit/blob/main/scripts/seeds/apple-text-hyperframes.json on 2026-07-02T18:41:19.435Z.
Verify against source before relying on details.