# Feature Specification: Full Page Scroll View, Practice Mode Switcher, Practice Chunk Size, & Print Sheet

## User Story
As a performer, musician, or memorizer using By Heart:
1. **Full Page View (Modal / View Mode):** I want to view my song in a clean, scrollable, full-page view similar to the Refine Chunk editor modal (monospaced lines, line numbers, chord progressions, clean stage aesthetic, without necessarily editing or focusing on just one chunk), accessible directly from the playlist dropdown alongside Chain, Scaffold, and Flashcards (or as a view mode), as well as from within practice mode.
2. **In-Practice Modality Switcher:** When I am practicing (e.g., in Chaining mode clicking "Cumulative Chain" / strategy or the mode selector), I want to switch fluidly between Cumulative Chain, Sliding Windows, Word Scaffold, Flashcards, and the new Page Scroll View without having to exit to the playlist first.
3. **In-Practice Chunk Size Control:** I want to adjust the chunk size (lines per chunk) directly from inside practice mode so I can re-chunk my song on the fly as my memorization needs change.
4. **Print Feature:** I want to print or export a clean, printer-friendly formatted sheet of the song (honoring chord annotations, compact layout, section breaks, and clean margins without dark-mode ink waste or UI button clutter).

---

## Key Requirements & UX Design

### 1. Full Page Scroll View (`page` view mode / modal)
- **Concept:** Take the polished layout of `RefineChunkModal` (line numbers, monospaced typography, clear chord exceptions & progressions, clean paper/stage aesthetic) and make it available as a dedicated readable Full Song Page View.
- **Entry points:**
  - **Playlist View:** Added to the modality options (Chain, Scaffold, Flashcards, Page View / Sheet View) or quick view button.
  - **Practice Modes:** Accessible from the top bar mode switcher in practice mode.
- **Features in Page View:**
  - Full-song vertical scroll with line numbers and section headers.
  - Highlighting / visual cues for sections or chunks.
  - Quick toggle to enter Practice (Chain / Scaffold / Flashcards) or Edit mode.
  - Embedded **Print** button right on the header/toolbar.

### 2. Practice Mode Modality Switcher
- Currently, inside `ChainingMode`, the button showing "Cumulative Chain" (or 2-part window, etc.) opens the Chaining Strategy popup.
- Clicking the mode indicator in practice mode should allow switching seamlessly between:
  - **Chain & Loop** (with its strategy sub-options: Cumulative Chain, 2-Part Window, 3-Part Window)
  - **Word Scaffold**
  - **Flashcards**
  - **Page View** (Full Scrolling Sheet)
- Similarly, provide unified top-bar mode switching in `ScaffoldMode` and `FlashcardMode` so the user can freely pivot between modes for the active song without having to click the back button to Playlist.

### 3. In-Practice Chunk Size Adjuster
- Chaining mode currently receives `onChangeChunkSize`, but previously only exposed the chunker popover from `PlaylistView`.
- Add a Chunk Size button/pill (e.g., `4L Chunks` with dropdown or opening `ChunkSizePopover`) directly in the header toolbar of `ChainingMode` (and other relevant practice views).
- Changing chunk size updates the song immediately and recalculates parsed chunks without resetting the user's overall progress unnecessarily or throwing state errors.

### 4. Print Feature
- A dedicated **Print** action (triggering `window.print()`).
- Add `@media print` CSS rules in `src/index.css` (or dedicated print styles) to:
  - Strip background colors/gradients, shadows, headers, floating nav buttons, and backdrop blurs to preserve ink.
  - Ensure pure black text on white background (`color: #000; background: #fff`).
  - Preserve monospace formatting, chord positions, section headers, and tab lines without cutoff.
  - Avoid awkward page breaks inside chord+lyric pairs or tablature blocks (`break-inside: avoid; page-break-inside: avoid`).
  - Provide a dedicated print layout or clean view that automatically renders properly when `window.print()` is invoked.

---

## Acceptance Criteria

- [ ] **A. Page View Mode:**
  - [ ] Add `page` (Full Page / Sheet View) as a supported view mode or accessible modal in the app.
  - [ ] Page View displays line numbers, monospaced formatted chords/lyrics, section headers, and clean scrollable container matching the refined style seen in the Refine Chunk modal.
  - [ ] Can be opened from the Playlist mode dropdown/actions and from inside Practice mode.

- [ ] **B. In-Practice Modality Switcher:**
  - [ ] Inside `ChainingMode`, the mode/strategy control allows navigating to Scaffold, Flashcards, or Page View.
  - [ ] `ScaffoldMode` and `FlashcardMode` also support fast switching between modalities for the active song.
  - [ ] Switching updates the song's `lastMode` and smoothly switches views without losing the active song context.

- [ ] **C. In-Practice Chunk Size Control:**
  - [ ] Chunk size pill/popover is visible and interactive directly inside practice mode header.
  - [ ] Opening it allows selecting 2L, 3L, 4L, 6L, 8L or custom chunk sizes using `ChunkSizePopover`.
  - [ ] Updating chunk size immediately re-chunks the active song and persists via `onChangeChunkSize`.

- [ ] **D. Print Feature:**
  - [ ] Print button available in the song view / Page View toolbar (and/or editor / playlist).
  - [ ] Clicking Print opens native print dialog via `window.print()`.
  - [ ] `@media print` styles ensure clean typography, no dark fills, no button UI elements, no overflow cutoffs, and clean page break boundaries for chords, lyrics, and guitar tabs.

---

## Affected Files

- `src/types.ts`: Update `PracticeMode` union type if `page` is added as a practice/view mode, or add auxiliary view state types.
- `src/App.tsx`: Handle modality switching directly between active practice modes and render Page View if applicable.
- `src/components/PlaylistView.tsx`: Expose Page View in mode selector dropdown or actions; include print option.
- `src/components/ChainingMode.tsx`: Add in-practice mode switcher menu (Chain, Scaffold, Cards, Page View), integrate `ChunkSizePopover`, and add Print trigger.
- `src/components/ScaffoldMode.tsx`: Add mode switcher to switch over to Chain, Flashcards, or Page View; add Print trigger.
- `src/components/FlashcardMode.tsx`: Add mode switcher to switch over to Chain, Scaffold, or Page View.
- `src/components/SongPageView.tsx` *(new)*: Reusable full-page scroll view modeled after the screenshot, with line numbers, chords, print action, and clean scrolling.
- `src/index.css`: Add print styling (`@media print`) and print utility classes.

---

## Acceptance Tests & Verification Plan

1. **Unit & Component Tests (`npm test`):**
   - Test mode switching helper / state updates in `App.tsx` and components.
   - Verify `ChunkSizePopover` functions correctly inside practice mode.
   - Test `SongPageView` rendering all sections, line numbers, and chord exception lines.
2. **Build & Lint (`npm run lint`, `npm run build`):**
   - Ensure zero TypeScript errors, clean linting, and successful Vite production build.
3. **Manual / Interactive Flow Verification:**
   - Open playlist -> select Page View -> song renders in full scrolling view with line numbers.
   - Open Chaining mode -> click mode/strategy control -> switch directly to Word Scaffold or Flashcards -> verify smooth transition.
   - Change chunk size from within Chaining mode -> verify chunks update dynamically (e.g. 2L -> 4L -> 8L).
   - Trigger Print -> verify print media styles hide navigation bars, dark background, and format text cleanly on white paper.

---

## Potential Risks & Mitigations

- **Mode State Drift:** Adding `'page'` to `PracticeMode` could affect saved data in localStorage or Firebase sync if older clients don't recognize `'page'`.
  *Mitigation:* Keep `PracticeMode = 'chain' | 'scaffold' | 'flashcards' | 'page'` backwards-compatible with graceful fallback to `'chain'`.
- **Print Layout Pagination:** Long multi-line tabs or chord-over-lyric pairs splitting across paper page breaks.
  *Mitigation:* Apply CSS `break-inside: avoid;` to `.parsed-line-pair` and `.section-block` elements in `@media print`.
- **Chaining State on Chunk Size Change:** Changing chunk size while mid-chain could point `stepIndex` out of range.
  *Mitigation:* Clamp or reset `stepIndex` safely to part bounds when chunk count changes.

---

### Mid-Flight Adjustments & Additions

#### 1. Landscape A4 Page Bounds Confinement
- **Issue:** Resizing in landscape allowed the sheet to stretch vertically beyond standard A4 landscape proportions.
- **Resolution:** Explicitly locked landscape `.print-page-sheet` to `height: a4PageHeight, maxHeight: a4PageHeight, overflow: hidden`, with `flex-1 overflow-hidden min-h-0` for the columns container. In `pdfGenerator.ts`, clamped vertical rendering above the footer (`curY < minContentY`) to guarantee strict A4 landscape bounds.

#### 2. Oversizing & Truncation Handling in Multi-Column Mode
- **Issue:** In 2 and 3 column mode, non-tab lines (lyrics, chords over lyrics, progressions, headers) lacked overflow containment, causing text to spill horizontally into adjacent columns when scaled up.
- **Resolution:** Added `overflow-hidden` across all section line elements (`chordOverLine`, `lyric`, `preLineProgressions`, `introducedProgression`, `standaloneProgressions`, and section headers) with `min-w-0` on column parents. In `pdfGenerator.ts`, added character truncation based on exact column width (`maxChars = Math.floor(colWidth / (fontSize * 0.6))`), ensuring text truncates neatly at column margins rather than overlapping adjacent columns.

#### 3. Font Scale Ceiling
- **Adjustment:** Increased the manual font scale upper limit from 130% to 150% in both the preview UI and PDF generator.

#### 4. Resize Reset Button Removal
- **Adjustment:** Removed the transient `RotateCcw` reset button that previously popped into the resize pill after adjusting scale, which caused button shifting and misclicks when clicking A+ or A- in succession.

#### 5. Mobile / Narrow-Screen Header Adaptations
- **Issue:** On phone aspects, the non-functional top-left red file/print icon and title consumed horizontal space, causing controls to overflow and pushing the modal close ("X") button off-screen.
- **Resolution:** Hidden the left icon and title on mobile viewports (`hidden md:flex`). On narrow screens, the resize control omits the percentage text and renders minimal `-` / `+` icons in place of `A-` / `A+`. Sized all 6 controls (`Col`, `Resize`, `Copy`, `Print`, `PDF`, and `Close`) with compact padding so they comfortably remain on a single line on all phone screen sizes without pushing the close button off-screen.
