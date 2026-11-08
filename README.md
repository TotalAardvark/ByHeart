# ❤️ ByHeart

**ByHeart** is a cognitive-science-driven memorization and practice studio for musicians, vocalists, actors, and speakers. Built to transform dense, repetitive chord sheets or long-form texts into structured, rapid-acquisition practice sessions, ByHeart replaces passive re-reading ("the illusion of competence") with active, neuro-mechanically grounded recall workflows.

Designed as an offline-first Progressive Web App (PWA), ByHeart runs smoothly on desktop displays, tablets on a music stand, and natively on your iPhone home screen.

---

## 🧠 The Cognitive Science Behind ByHeart

Traditional memorization relies on starting at line 1 and reading top-to-bottom until you make a mistake—a method known in cognitive psychology as **massed passive review**. This creates a steep "serial position effect" where you over-practice the beginning of a piece, stumble in the middle, and remain tethered to the page.

ByHeart is engineered around four proven principles of human memory consolidation and motor-sequence learning:

### 1. Cognitive Chunking (Working Memory Optimization)
* **Scientific Basis:** First formalized by George A. Miller (1956) and expanded by Nelson Cowan (2001), human working memory has a strict bottleneck of roughly $4 \pm 1$ discrete items at a time. When you stare at a 60-line chord and lyric sheet, cognitive overload prevents the hippocampus from encoding structural patterns. **Chunking** is the process of binding individual lines, rhythmic phrases, and harmonic loops into compressed, unified mental schemas.
* **How ByHeart Implements It:**
  * **Configurable Stanza Chunks:** Songs are automatically segmented into digestible $N$-line cognitive chunks (defaulting to 4 lines—a standard musical quatrain—adjustable from 1 to 32 lines per song).
  * **Harmonic Loop Compression (`[ C - F ]`):** Rather than reading 16 individual chord symbols scattered over four lines of lyrics, ByHeart's Smart Compactor extracts the underlying harmonic cycle into a single state-badge (`[ C - F ]`), displaying inline chords *only* where a "pattern-breaker" or turnaround exception occurs. You memorize **one rule + one exception** instead of 16 isolated data points.
  * **Macro-Structural Deduplication:** Repeated sections (e.g., *5. Chorus*) are collapsed into structural pointers so your brain encodes the song's architecture as a high-level map rather than a wall of redundant text.

### 2. Serial Forward Chaining & Sliding Windows (Associative Motor Linking)
* **Scientific Basis:** Drawn from behavioral psychology (B.F. Skinner) and motor-sequence acquisition research, **chaining** breaks a complex temporal sequence ($A \rightarrow B \rightarrow C \rightarrow D$) into discrete links. A common failure in performance is mastering sections in isolation ($A$, $B$, $C$) while failing at the *transitions* between them ($A \rightarrow B$) because the end of section $A$ has not been conditioned as the retrieval cue for the start of section $B$.
* **How ByHeart Implements It:**
  * **Guided Forward Chaining (`1 → 2 → 1+2 → 3 → 1+2+3`):** You first master Chunk 1 in isolation, then Chunk 2 in isolation, and immediately weld them together (`1+2`) before introducing Chunk 3 (`3`, then `1+2+3`).
  * **Smart Repeat Skipping:** When the chain reaches a section you've already learned (like a second Chorus), ByHeart automatically skips the isolated learning step and jumps straight to the concatenated chain step to test your transition into and out of the repeat.
  * **Sliding Window Mode (`2-Part` / `3-Part` Windows) & Custom Loops:** For longer pieces, chaining `1..12` every step becomes fatiguing. Sliding Windows (`[1+2] → [2+3] → [3+4]`) isolate adjacent boundary transitions, while Custom Range selection lets you loop trouble spots.
  * **Two-Phase Blanking Recall Stage:** Advancing a step can optionally trigger an intermediate **Blanked Stage**—hiding lyrics, chords, or both while keeping section headers visible—forcing true *active retrieval* (the Testing Effect; Roediger & Karpicke, 2006) before advancing to the next link in the chain.

### 3. Word Scaffolding & Vanishing Cues (Lexical Retrieval Priming)
* **Scientific Basis:** Based on Vygotsky's *Zone of Proximal Development* and the **Method of Vanishing Cues** (Glisky, Schacter, & Tulving, 1986) in neuropsychology. Memory retrieval is associative and reconstructive: often, a performer knows an entire verse "by heart" in long-term storage, but suffers a momentary tip-of-the-tongue block at the start of a couplet or stanza. Providing the smallest possible lexical prime (the first word or a key phonetic anchor) triggers **spreading activation** across the semantic and phonological network, allowing the brain to reconstruct the rest of the line autonomously without falling back on full-text reading.
* **How ByHeart Implements It:**
  * **Automated First-Word Anchors:** Instantly mask the entire song while leaving the opening word of every 2nd or 4th line visible as a rhythmic launchpad.
  * **Interactive Click-and-Drag Word Painting:** Switch to Edit Highlights mode and swipe across specific "mental block" words, rhyme anchors, or tricky entrances to build a personalized lexical skeleton.
  * **Ghost Masking & Instant Peek:** Un-scaffolded words are rendered as subtle ghost blocks that preserve exact syllable spacing and visual cadence, with a one-tap Peek toggle to verify accuracy.

### 4. Asynchronous Recall / Flashcards (Context-Independent Retrieval & Desirable Difficulties)
* **Scientific Basis:** Practicing a song strictly in chronological order builds **serial dependence**—where Line 4 is only accessible if you just sang Line 3. If a distraction occurs mid-performance, the chain breaks. Robert Bjork's theory of **Desirable Difficulties** (1994) and interleaved active recall demonstrate that pulling sections out of sequence strengthens context-independent retrieval pathways and solidifies boundary transitions.
* **How ByHeart Implements It:**
  * **Entry Trigger Cards:** Prompts you with a section/chunk title and the final line of the *preceding* section (`After: "...Than they ever would do in a jar"`), challenging you to recall the opening lyrics and harmonic loop cold.
  * **Phrase Completion & Turnaround Cards:** For multi-line stanzas, prompts you with the opening couplet and tests whether you can finish the stanza—including pattern-breaker turnaround chords.
  * **Adaptive Mastery Queue:** Shuffle the deck for interleaved practice, flip cards with `Space`, and mark cards as **Keep Practicing** (re-queued down the deck for spaced intra-session repetition) or **Got It** (retired from the active queue).

---

## ✨ Core Features

### 🪄 Smart Compactor & "ByHeart Notation"
Paste raw chord sheets directly from Ultimate Guitar (or import via URL) and transform them with one click into clean, stage-ready **ByHeart Notation**:
* **Loop Extraction (`[ Am - C ]`):** Detects repeating 1-line and 2-line chord cycles (including Ultimate Guitar's common boundary-chord omissions) and collapses them into a single bracketed progression header.
* **Exception-Only Overlines:** Keeps monospaced chord-over-lyric positioning *only* for chords that break the active loop or occur on turnarounds.
* **Consecutive Duplicate Suppression:** Eliminates redundant chord symbols when a single chord drones across multiple consecutive lines.
* **Voicing Simplification:** Optional toggles to simplify complex extensions (`Cmaj7`, `Fadd9`, `Gsus4` $\rightarrow$ `C`, `F`, `G`) and dominant 7ths (`E7` $\rightarrow$ `E`).
* **Repeated Section Collapsing:** Automatically turns duplicate choruses/refrains into lightweight structural references (e.g., `5. Chorus`).
* **Locked Blocks (`{ ... }`) & Silence Tags (`(( ... ))`):** Preserve literal ASCII guitar tabs together as an unsplit chunk using `{ ... }`, or wrap tuning/capo notes and chord diagrams in `(( ... ))` so they stay saved in your editor without cluttering the practice stage.

### 🎛️ Three Specialized Practice Modalities
1. **Chain & Loop (`ChainingMode`):**
   * Toggle between **Chunk** (stanza-level) and **Section** (verse/chorus-level) granularity.
   * Choose between **Guided Chain**, **2-Part Window**, **3-Part Window**, or **Custom Range**.
   * Configurable **Blanking Recall Stage** (blank Lyrics & Chords, Lyrics Only, or Chords Only; apply on Every Step or New Parts Only).
   * Full keyboard navigation (`←` / `→` / `Space` to advance or reveal, `B` to toggle blanking, `G` to switch granularity).
2. **Word Scaffold (`ScaffoldMode`):**
   * Auto-anchor the 1st word of every **2 lines**, **4 lines**, or **Manual Only**.
   * Click or drag-paint across individual words to customize your visual prompts.
   * Hold or toggle **Peek All** to check hidden lyrics against your memory.
3. **Flashcards (`FlashcardMode`):**
   * Auto-generated **Entry Trigger** and **Phrase Completion** cards from your parsed song structure.
   * 3D card flip, Shuffle mode, mastery progress bar, and keyboard shortcuts (`Space` to flip, `1` / `←` to repeat, `2` / `→` for Got It).

### 📐 Adaptive Multi-Column Stage Layout
* **Zero-Scroll Stage Fitting:** Dynamically measures line widths, visual weights, and viewport geometry to split long chains or full-song scaffolds into balanced multi-column layouts—maximizing font legibility without vertical scrolling during practice.
* **Responsive Portrait & Landscape Modes:** Tailored ergonomics whether you're holding an iPhone vertically on the go or propping an iPad/laptop horizontally on a music stand.

### 🎨 6 Curated Studio Themes & Local-First Library
* Switch seamlessly between dark and light studio palettes: **Ocean Depth**, **Crimson Citrus**, **Sunset Dusk**, **Midnight Velvet**, **Pastel Sorbet**, and **Terracotta Canyon**.
* **100% Local & Private:** Your playlist, custom word scaffolds, chunk preferences, and raw sources are persisted automatically in `localStorage`.
* **JSON Library Backup:** Export your entire song library to a `.json` file or import backups across devices with a single click.

---

## 📝 ByHeart Notation Quick Reference

```text
Rotterdam (Or Anywhere) - The Beautiful South
(( Capo 2 • Standard Tuning ))

1. Verse 1
[ C - F ]
And the women tug their hair
Like they're trying to prove it won't fall out
And all the men are gargoyles
Dipped long in Irish stout

2. Pre-Chorus
   G
The whole place is pickled
                                  Am
The people are pickles for sure
   G
And no-one knows if they've done more here
           C              E7
Than they ever would do in a jar

3. Chorus
[ Am - C ]
This could be Rotterdam or anywhere, Liverpool or Rome,
                                   D7         G7
'Cause Rotterdam is anywhere, anywhere alone,
Anywhere alone

4. Verse 2
...

5. Pre-Chorus

6. Chorus
```

* **`1. Section Name`**: Numbered section header. An empty numbered section whose name matches an earlier section (like `5. Pre-Chorus` above) automatically inherits that section's lyrics and chords.
* **`[ Chord - Chord ]`**: Sets the active background chord loop from that line forward until a new `[ ... ]` loop is introduced.
* **Chord-over-lyric line**: Any line consisting of chord tokens positioned above a lyric line is rendered as an inline harmonic exception.
* **`{ ... }`**: Locks a multi-line block (such as an ASCII guitar tab) so it is never split across chunks.
* **`(( ... ))`**: Silences notes, metadata, or chord diagrams during practice while keeping them in your song file.

---

## 📱 Installing on iPhone / iPad (iOS Home Screen PWA)

ByHeart is configured as a standalone Progressive Web App so it launches full-screen from your iPhone home screen without Safari's address bar or navigation chrome:

1. Open the hosted GitHub Pages URL in **Safari** on your iPhone or iPad.
2. Tap the **Share** button (the square with an upward arrow at the bottom of the screen).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add** in the top-right corner.
5. Launch **ByHeart** directly from your home screen—it will run in full-screen standalone mode and cache its assets for offline practice.

---

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Run the unit test suite (Vitest)
npm test

# Build for production
npm run build
```
