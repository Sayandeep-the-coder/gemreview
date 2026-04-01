# GemReview — AI Agent Fix Prompt

You are an expert software engineer.
Fix every issue listed below. Each issue is tagged with its exact
file path and line number. Patch context is included so you can
locate the code immediately without searching.

Do not ask clarifying questions. Fix everything in one pass.
After fixing, verify against the DONE CRITERIA at the bottom.

## PR Details

- **Title:** Timeline demo Section
- **URL:** https://github.com/DevelopersCommunity-KGEC/Binary-web-2k26/pull/1
- **Reviewed by:** GemReview (model: gemini-2.5-flash)
- **Total findings:** 11
- **By severity:** 🔴 0 critical · 🟠 1 high · 🟡 10 medium · 🔵 0 low

## Files to Change

These are the only files that need edits:

- 🟠 `app/components/Timeline.tsx` — 4 finding(s)
- 🟡 `app/components/Middle_Timeline _Text Box.tsx` — 2 finding(s)
- 🟡 `app/components/PacmanPathMobileSVG.tsx` — 2 finding(s)
- 🟡 `app/components/PacmanPathSVG.tsx` — 2 finding(s)
- 🟡 `app/hooks/useMediaQuery.tsx` — 1 finding(s)

---

## Findings — Grouped by File

### 📄 `app/components/Timeline.tsx`

#### Finding 1 — 🧪 Test Coverage Gap | 🟠 HIGH — fix before merge

**Location:**
```
File: app/components/Timeline.tsx
Line: 20
```

**Issue:**
The `Timeline` component contains extensive and complex animation logic using GSAP and ScrollTrigger for desktop, tab, and mobile views. This entire `useEffect` block is untested, making it highly susceptible to regressions and unexpected behavior across different browsers or scroll positions.

**Fix:**
Add integration tests to verify that animations are triggered correctly by ScrollTrigger, Pacman mouth chomping works, and elements follow their paths. Consider mocking GSAP for unit tests to ensure correct animation property setup. Test scenarios where DOM elements are missing.

**Patch context** (lines surrounding the issue):
```diff
  15 | +gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);
  16 | +import PacmanPathSVG from './PacmanPathSVG';
  17 | +// import useTextScramble from "../Animations/text";
  18 | +// import { useInView } from 'react-intersection-observer';
  19 | +
  20 | + ◀ ISSUE HERE
  21 | +
  22 | +const Timeline = () => {
  23 | +  useEffect(() => {
  24 | +    // Pacman Chomp Animation Shape
  25 | +    // Pacman Chomp Animation Shapes
```

#### Finding 2 — 🐛 Bug / Code Quality | 🟡 MEDIUM — fix in this PR or follow-up

**Location:**
```
File: app/components/Timeline.tsx
Line: 60
```

**Issue:**
The `duration` for the `desktopPacman` `motionPath` animation is set to `5`, while the `strokeDashoffset` animation for its path (`desktopPath`) is `10`. This causes the Pacman to complete its journey along the path twice as fast as the path itself is being drawn, leading to a visual desynchronization. The mobile animation correctly uses matching durations.

**Fix:**
Ensure the `duration` for the `motionPath` animation of `desktopPacman` matches the `duration` of its path's `strokeDashoffset` animation (i.e., change `duration: 5` to `duration: 10` for the pacman animation).

**Patch context** (lines surrounding the issue):
```diff
  55 | +        const length = desktopPath.getTotalLength();
  56 | +        gsap.set(desktopPath, { strokeDasharray: 10 });
  57 | +        
  58 | +        gsap.fromTo(desktopPath,
  59 | +            { strokeDashoffset: 0 },
  60 | +            { ◀ ISSUE HERE
  61 | +                strokeDashoffset: length,
  62 | +                duration: 10,
  63 | +                ease: "none",
  64 | +                scrollTrigger: {
  65 | +                    trigger: desktopSvg,
```

#### Finding 3 — 🐛 Bug / Code Quality | 🟡 MEDIUM — fix in this PR or follow-up

**Location:**
```
File: app/components/Timeline.tsx
Line: 85
```

**Issue:**
The `duration` for the `tabPacman` `motionPath` animation is set to `5`, while the `strokeDashoffset` animation for its path (`tabPath`) is `10`. This causes the Pacman to complete its journey along the path twice as fast as the path itself is being drawn, leading to a visual desynchronization. The mobile animation correctly uses matching durations.

**Fix:**
Ensure the `duration` for the `motionPath` animation of `tabPacman` matches the `duration` of its path's `strokeDashoffset` animation (i.e., change `duration: 5` to `duration: 10` for the pacman animation).

**Patch context** (lines surrounding the issue):
```diff
  80 | +                end: 1,
  81 | +            },
  82 | +            transformOrigin: "50% 50%",
  83 | +            duration: 5,
  84 | +            ease: "none",
  85 | +            immediateRender: true, ◀ ISSUE HERE
  86 | +            scrollTrigger: {
  87 | +                trigger: desktopSvg,
  88 | +                start: "top 30%",
  89 | +                end: "bottom bottom",
  90 | +                scrub: 2,
```

#### Finding 4 — ⚡ Performance Optimisation | 🟡 MEDIUM — fix in this PR or follow-up

**Location:**
```
File: app/components/Timeline.tsx
Line: 199
```

**Issue:**
The `PacmanPathSVG` component is rendered twice in the DOM, once for desktop and once for tab view, with one being hidden via CSS (`display: none`). This leads to unnecessary parsing, rendering, and memory usage for the hidden SVG, especially for complex SVG structures like the background maze paths.

**Fix:**
Conditionally render only the `PacmanPathSVG` instance relevant to the current viewport size using a client-side media query hook (e.g., `useMediaQuery`) instead of rendering both and hiding with CSS.

**Patch context** (lines surrounding the issue):
```diff
 194 | +        scrub: 2,
 195 | +      }
 196 | +    });
 197 | +
 198 | +    const desktopBoxes = [
 199 | +      ".second-timeline-box", ◀ ISSUE HERE
 200 | +      ".first-timeline-box", 
 201 | +      ".fourth-timeline-box",
 202 | +      ".third-timeline-box",
 203 | +      ".sixth-timeline-box",
 204 | +      ".fifth-timeline-box"
```

---

### 📄 `app/components/Middle_Timeline _Text Box.tsx`

#### Finding 5 — 🔒 Security Vulnerability | 🟡 MEDIUM — fix in this PR or follow-up

**Location:**
```
File: app/components/Middle_Timeline _Text Box.tsx
Line: 14
```

**Issue:**
The `className` prop is directly concatenated into the `div`'s class attribute. If this prop were ever populated with untrusted user input without proper sanitization, an attacker could inject malicious CSS (leading to UI defacement or data exfiltration) or interfere with styling.

**Fix:**
Ensure that any `className` prop values derived from user input are strictly validated against a whitelist of allowed classes or sanitized to remove potentially malicious characters. For styling, prefer using a utility like `clsx` or `tailwind-merge` with controlled inputs.

**Patch context** (lines surrounding the issue):
```diff
   9 | +
  10 | +
  11 | +const MiddleTimelineBox: React.FC<MiddleTimelineBoxProps> = ({ title, subtitle, className }) => {
  12 | +    return (
  13 | +        <div className={`${className} relative w-[20.5rem] h-[5.7rem] lg:w-[25.25rem] lg:h-[7.25rem] `}>
  14 | +            <div ◀ ISSUE HERE
  15 | +                className={`absolute drop-shadow-[12px_8px_49px_rgba(117,255,58,0.21)] flex flex-col gap-1 items-center box-border w-[20.5rem] h-[5.7rem] lg:w-[25.25rem] lg:h-[7.25rem] bg-black border-4 border-[#034D03]`}
  16 | +            >
  17 | +                <div className="w-[20.5rem] h-[5.7rem] relative flex flex-col justify-center items-center box-border lg:w-[25.25rem] lg:h-[7.25rem]">
  18 | +                    <p className="absolute font-['SF_Pixelate'] font-bold text-[1.5rem] lg:text-[2rem] leading-[2.875rem] text-white">
  19 | +                        {title}
```

#### Finding 6 — 🧪 Test Coverage Gap | 🟡 MEDIUM — fix in this PR or follow-up

**Location:**
```
File: app/components/Middle_Timeline _Text Box.tsx
Line: 10
```

**Issue:**
The new `MiddleTimelineBox` component lacks basic unit or snapshot tests to ensure it renders correctly with various `title`, `subtitle`, and `className` props. This could lead to unintended UI regressions.

**Fix:**
Add a test file (e.g., `MiddleTimelineBox.test.tsx`) with tests to verify the component renders the provided title and subtitle, and applies the `className` correctly. Snapshot tests could also be beneficial.

**Patch context** (lines surrounding the issue):
```diff
   5 | +    subtitle: string;
   6 | +    className?: string;
   7 | +};
   8 | +
   9 | +
  10 | + ◀ ISSUE HERE
  11 | +const MiddleTimelineBox: React.FC<MiddleTimelineBoxProps> = ({ title, subtitle, className }) => {
  12 | +    return (
  13 | +        <div className={`${className} relative w-[20.5rem] h-[5.7rem] lg:w-[25.25rem] lg:h-[7.25rem] `}>
  14 | +            <div
  15 | +                className={`absolute drop-shadow-[12px_8px_49px_rgba(117,255,58,0.21)] flex flex-col gap-1 items-center box-border w-[20.5rem] h-[5.7rem] lg:w-[25.25rem] lg:h-[7.25rem] bg-black border-4 border-[#034D03]`}
```

---

### 📄 `app/components/PacmanPathMobileSVG.tsx`

#### Finding 7 — 🔒 Security Vulnerability | 🟡 MEDIUM — fix in this PR or follow-up

**Location:**
```
File: app/components/PacmanPathMobileSVG.tsx
Line: 10
```

**Issue:**
The `className_svg`, `className_path`, `pathId`, and `pacmanClass` props are directly rendered into HTML/SVG attributes. If these props were ever populated with untrusted user input without proper sanitization, an attacker could inject malicious CSS or manipulate DOM elements by controlling IDs.

**Fix:**
Ensure that any prop values (`className_svg`, `className_path`, `pathId`, `pacmanClass`) derived from user input are strictly validated against a whitelist of allowed values or sanitized to remove potentially malicious characters. For `id`, ensure uniqueness and restrict characters.

**Patch context** (lines surrounding the issue):
```diff
   5 | +    className_path?: string;
   6 | +    pathId?: string;
   7 | +    pacmanClass?: string;
   8 | +};
   9 | +
  10 | +const PacmanPathMobileSVG: React.FC<PacmanPathMobileSVGProps> = ({ ◀ ISSUE HERE
  11 | +    className_svg,
  12 | +    className_path,
  13 | +    pathId = "path-mobile",
  14 | +    pacmanClass = "pattern-rect-mobile z-10 render-pixelated ",
  15 | +}) => {
```

#### Finding 8 — 🧪 Test Coverage Gap | 🟡 MEDIUM — fix in this PR or follow-up

**Location:**
```
File: app/components/PacmanPathMobileSVG.tsx
Line: 10
```

**Issue:**
The new `PacmanPathMobileSVG` component, which renders a complex SVG structure, has no associated tests. This leaves its rendering behavior and prop handling untested, risking visual bugs.

**Fix:**
Implement tests (e.g., snapshot tests) to ensure the SVG structure is consistent and that props like `className_svg`, `className_path`, `pathId`, and `pacmanClass` are correctly applied and reflected in the rendered output.

**Patch context** (lines surrounding the issue):
```diff
   5 | +    className_path?: string;
   6 | +    pathId?: string;
   7 | +    pacmanClass?: string;
   8 | +};
   9 | +
  10 | +const PacmanPathMobileSVG: React.FC<PacmanPathMobileSVGProps> = ({ ◀ ISSUE HERE
  11 | +    className_svg,
  12 | +    className_path,
  13 | +    pathId = "path-mobile",
  14 | +    pacmanClass = "pattern-rect-mobile z-10 render-pixelated ",
  15 | +}) => {
```

---

### 📄 `app/components/PacmanPathSVG.tsx`

#### Finding 9 — 🔒 Security Vulnerability | 🟡 MEDIUM — fix in this PR or follow-up

**Location:**
```
File: app/components/PacmanPathSVG.tsx
Line: 13
```

**Issue:**
The `className_svg`, `className_path`, `pathId`, `pacmanClass`, and `preserveAspectRatio` props are directly rendered into HTML/SVG attributes. If these props were ever populated with untrusted user input without proper sanitization, an attacker could inject malicious CSS or manipulate DOM elements by controlling IDs.

**Fix:**
Ensure that any prop values (`className_svg`, `className_path`, `pathId`, `pacmanClass`, `preserveAspectRatio`) derived from user input are strictly validated against a whitelist of allowed values or sanitized to remove potentially malicious characters. For `id`, ensure uniqueness and restrict characters.

**Patch context** (lines surrounding the issue):
```diff
   8 | +  preserveAspectRatio?: string;
   9 | +};
  10 | +
  11 | +const PacmanPathSVG: React.FC<PacmanPathSVGProps> = ({
  12 | +  className_svg,
  13 | +  className_path, ◀ ISSUE HERE
  14 | +  pathId = "path-desktop",
  15 | +  pacmanClass = "pattern-rect-desktop",
  16 | +  preserveAspectRatio = "xMidYMin meet"
  17 | +}) => {
  18 | +  return (
```

#### Finding 10 — 🧪 Test Coverage Gap | 🟡 MEDIUM — fix in this PR or follow-up

**Location:**
```
File: app/components/PacmanPathSVG.tsx
Line: 12
```

**Issue:**
The new `PacmanPathSVG` component, which renders a complex SVG structure for desktop/tab views, has no associated tests. This leaves its rendering behavior and prop handling untested, risking visual bugs.

**Fix:**
Implement tests (e.g., snapshot tests) to ensure the SVG structure is consistent and that props like `className_svg`, `className_path`, `pathId`, `pacmanClass`, and `preserveAspectRatio` are correctly applied.

**Patch context** (lines surrounding the issue):
```diff
   7 | +  pacmanClass?: string;
   8 | +  preserveAspectRatio?: string;
   9 | +};
  10 | +
  11 | +const PacmanPathSVG: React.FC<PacmanPathSVGProps> = ({
  12 | +  className_svg, ◀ ISSUE HERE
  13 | +  className_path,
  14 | +  pathId = "path-desktop",
  15 | +  pacmanClass = "pattern-rect-desktop",
  16 | +  preserveAspectRatio = "xMidYMin meet"
  17 | +}) => {
```

---

### 📄 `app/hooks/useMediaQuery.tsx`

#### Finding 11 — 🧪 Test Coverage Gap | 🟡 MEDIUM — fix in this PR or follow-up

**Location:**
```
File: app/hooks/useMediaQuery.tsx
Line: 3
```

**Issue:**
The `useMediaQuery` hook, which interacts with browser APIs (`window.matchMedia`) and manages state, lacks dedicated tests. This leaves its core functionality, event listener management, and SSR compatibility untested.

**Fix:**
Add unit tests for `useMediaQuery` to verify: 1. Initial match state is correct. 2. State updates when the media query changes. 3. Event listeners are correctly added and removed (cleanup). 4. It handles non-browser environments gracefully.

**Patch context** (lines surrounding the issue):
```diff
   1 | +import React, { useEffect, useState } from 'react'
   2 | +
   3 | +export const useMediaQuery = (query: string) => { ◀ ISSUE HERE
   4 | +    const [matches, setMatches] = useState(false)
   5 | +
   6 | +    useEffect(() => {
   7 | +        if (typeof window !== 'undefined') {
   8 | +            const media = window.matchMedia(query)
```

---

## Done Criteria

Your work is complete when every item below is checked:

**`app/components/Timeline.tsx`**
- [ ] Line 20: 🧪 Untested GSAP animation and ScrollTrigger logic
- [ ] Line 60: 🐛 Pacman animation duration mismatch
- [ ] Line 85: 🐛 Pacman animation duration mismatch
- [ ] Line 199: ⚡ Redundant SVG rendering for different viewports

**`app/components/Middle_Timeline _Text Box.tsx`**
- [ ] Line 14: 🔒 Potential CSS/DOM Injection via Unsanitized className
- [ ] Line 10: 🧪 Missing tests for new UI component

**`app/components/PacmanPathMobileSVG.tsx`**
- [ ] Line 10: 🔒 Potential CSS/DOM Injection via Unsanitized Props
- [ ] Line 10: 🧪 Missing tests for new SVG component

**`app/components/PacmanPathSVG.tsx`**
- [ ] Line 13: 🔒 Potential CSS/DOM Injection via Unsanitized Props
- [ ] Line 12: 🧪 Missing tests for new SVG component

**`app/hooks/useMediaQuery.tsx`**
- [ ] Line 3: 🧪 Missing tests for new custom hook

After making all changes:
- [ ] The project builds without errors (`npm run build`)
- [ ] All tests pass (`npm test`)
- [ ] No new `any` types introduced
- [ ] No secrets or API keys added anywhere

---
*Generated by GemReview — https://github.com/your-org/gemreview*