# Feature Specification: Curating Default Songs & Pieces in Sample Playlist

## User Story
As a new user launching By Heart for the first time,
I want the default songs and texts in my starter playlist to showcase clean, idiomatic, high-quality examples of how songs and poetry look and practice,
So that I can immediately understand the format conventions (compact chord loops, clean section headers, optional preamble chords/tuning) and practice effectively with appropriate chunk lengths.

Specifically:
1. **Shakespeare Sonnet 18** replaces *Ozymandias*:
   - Title: Sonnet 18 ("Shall I compare thee to a summer's day?") by William Shakespeare.
   - Short Name: `Shakespeare - Sonnet 18`.
   - Text broken into natural sonnet structure (Quatrain 1, Quatrain 2, Quatrain 3, Couplet).
   - Default `chunkSize` set to **2** lines (as specified).
   - Mode set to `chain` (Chaining), with `scaffoldEveryNLines: 2`.

### Mid-Flight Adjustments & Additions
- Short name explicitly set to: `Shakespeare - Sonnet 18`.
- Default mode set to: `chain` (Chaining).
- Per user instruction: Execute `/deploy` in the new worktree, but wait for user signal before merging into `main`.
2. **Shallow Cleaned-up Example**:
   - The default saved user tab for *Shallow* is updated to the user's provided cleaned-up version.
   - Preserves standard tuning and capo 2 preamble chord chart.
   - Cleans up section headers (1. Verse 1, 2. Refrain, 3. Verse 2, 4. Refrain, 5. Chorus, 6. Post-Chorus, 7. Bridge, 8. Chorus, 9. Post-Chorus).
   - Uses clean 2-line chord loops `[ Em7 - D/F# - G | C - G - D ]` and chorus loops `[ Am - D/F# | G - D - Em ]` without cluttered ad-hoc chord placements in refrains.
   - `customHighlights` updated/aligned with section/line indices in the new body.

---

## Acceptance Criteria
- [ ] In `src/lib/sampleSongs.ts`, replace the sample item `text-ozymandias` with Sonnet 18:
  - ID: `text-sonnet-18` (or clean migration if users had saved songs, though for default starter items `SAMPLE_SONGS` defines the initial state).
  - Short name: `Shakespeare - Sonnet 18`.
  - Body: Complete text of Shakespeare's Sonnet 18 with canonical quatrain / couplet sections (or numbered sections matching standard format).
  - Default `chunkSize`: `2`.
  - Default `scaffoldEveryNLines`: `2`.
  - Default mode: `chain` (Chaining).
- [ ] In `src/lib/sampleSongs.ts`, update `COMPACTED_SHALLOW_BODY` (and `SAMPLE_SONGS[0].body`) to match the user's exact cleaned-up Shallow text:
  - Preamble with `Standard tuning.`, `Capo 2`, and ASCII chord chart inside `(( ... ))`.
  - Numbered sections 1 to 9 matching the clean loop structure.
  - Refrains (sections 2 & 4) cleanly use the chord loop `[ Em7 - D/F# - G | C - G - D ]` without inline loose chords.
  - Check and update `SAMPLE_SONGS[0].customHighlights` so highlight coordinates are valid for the new line structure.
- [ ] Test suite verification:
  - In `src/lib/__tests__/compactorAndParser.test.ts`, ensure tests using `COMPACTED_SHALLOW_BODY` or sample songs pass, or update test expectations if test suites assert specific section counts/lines from the previous version.
  - Ensure all vitest tests (`npm test`), lint (`npm run lint`), and build (`npm run build`) pass cleanly.

---

## Affected Files
- `src/lib/sampleSongs.ts`: Update `COMPACTED_SHALLOW_BODY`, `SAMPLE_SONGS` (Shallow highlights and Sonnet 18 replacement).
- `src/lib/__tests__/compactorAndParser.test.ts`: Verify test cases referencing Shallow and Ozymandias / Sonnet 18.
- `specs/curate-default-playlist.md`: This specification file.

---

## Proposed Sonnet 18 Content

```
Sonnet 18 - William Shakespeare

1. Quatrain 1
Shall I compare thee to a summer's day?
Thou art more lovely and more temperate:
Rough winds do shake the darling buds of May,
And summer's lease hath all too short a date;

2. Quatrain 2
Sometime too hot the eye of heaven shines,
And often is his gold complexion dimm'd;
And every fair from fair sometime declines,
By chance or nature's changing course untrimm'd;

3. Quatrain 3
But thy eternal summer shall not fade,
Nor lose possession of that fair thou ow'st;
Nor shall death brag thou wander'st in his shade,
When in eternal lines to time thou grow'st:

4. Couplet
So long as men can breathe or eyes can see,
So long lives this, and this gives life to thee.
```

---

## Acceptance Tests
1. **Initial Sample Playlist Verification:**
   - Loading `SAMPLE_SONGS` produces 3 items: Shallow, Knockin', and Sonnet 18.
   - Sonnet 18 item has `chunkSize: 2`.
   - Shallow item has the updated clean body without inline chords in the refrains.
2. **Parser & Compactor Integration:**
   - `parseSong(shallowBody)` correctly identifies all 9 sections, detects preamble chords, loops, and lyrics.
   - `parseSong(sonnetBody)` parses 4 sections (3 quatrains, 1 couplet) without chords, and chunks properly with chunk size 2.
3. **Regression Tests:**
   - Vitest suite runs with 0 errors.
   - Typecheck and build succeed.

---

## Potential Risks / Edge Cases
- **Test coupling:** `compactorAndParser.test.ts` has multiple tests referencing Shallow. We need to check whether tests test the compactor output from `RAW_SHALLOW_UG_SAMPLE` or directly test `COMPACTED_SHALLOW_BODY`. If `COMPACTED_SHALLOW_BODY` changed, tests asserting line counts or section counts (like test step 13/14 column scaling) will need their input examined to avoid unexpected test breaks.
- **Strict Read-Only Enforcement:** No code files will be modified until this specification is approved.
