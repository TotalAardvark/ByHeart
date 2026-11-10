import { SongItem } from '../types';

export const RAW_SHALLOW_UG_SAMPLE = `Shallow - Lady Gaga & Bradley Cooper

Standard tuning.
Capo 2

   Em7  D/F#  G     C    Cadd9  D     Am   Em   Bm   A
e|(3)--(2)--(3)--(0)--(0)---2----0----0----2----0----|
B|-3----3----3----1----3----3----1----0----3----2----|
G|-0----2----0----0----0----2----2----0----4----2----|
D|-2----0----0----2----2----0----2----2----4----2----|
A|-2---(0)--(2)---3----3---------0----2----2----0----|
E|-0----2----3------------------------0--------------|

[Intro]
   Em7             D/F#             G
e|---------------3----------------2----------------3-------------------------|
B|---------3---3---3--------3---3---3--------3---3---3-----------------------|
G|-------0---0------------2---2------------0---0-----------------------------|
D|-----2----------------0----------------0-----------------------------------|
A|---2-----------------------------------------------------------------------|
E|-0------------------2----------------3-------------------------------------|
   1 + 2 + 3 + 4 + etc.

   C                G                D
e|---------------0----------------3----------------2h3p2---------------------|
B|---------1---1---1--------3---3---3--------3---3-------3-------------------|
G|-------0---0------------0---0------------2---2-----------2-----------------|
D|-----2----------------0----------------0-----------------------------------|
A|---3-----------------------------------------------------------------------|
E|--------------------3------------------------------------------------------|
   1 e + a 2 e + a 3 e + a 4 e + a
                           \\ 3 /

[Verse 1]
Em7  D/F#  G
  1 + 2 + 3 + 4 +

Em7      D/F#     G
  Tell me something, girl
C                 G     D
  Are you happy in this modern world?
Em7      D/F#    G
  Or do you need more?
C                       G     D
  Is there something else you're searchin' for?

[Refrain]
Em7      D/F#  G
  I'm fallin'
C                     G     D         Em7  D/F#  G
  In all the good times I find myself longin' for change
C                    G     D    Em7  D/F#  G
  And in the bad times I fear myself

[Verse 2]
Em7      D/F#     G
  Tell me something, boy
C                      G     D
  Aren't you tired tryin' to fill that void?
Em7      D/F#    G
  Or do you need more?
C                  G     D
  Ain't it hard keepin' it so hardcore?

[Refrain]
Em7      D/F#  G
  I'm fallin'
C                     G     D         Em7  D/F#  G
  In all the good times I find myself longin' for change
C                    G     D
  And in the bad times I fear myself

[Chorus]
Am               D/F#
I'm off the deep end, watch as I dive in
G        D       Em
I'll never meet the ground
Am                    D/F#
Crash through the surface, where they can't hurt us
G              D     Em
We're far from the shallow now

[Post-Chorus]
Am           D/F#
  In the sha-ha, shallow
G        D          Em
  In the sha-ha-sha-la-la-la-low
Am           D/F#
  In the sha-ha, shallow
G              D     Em
  We're far from the shallow now

[Bridge]
Bm                   D
Oh, ha-ah-ah, ah
A                    Em
Oh-ah, ha-ah-ah-ah
Bm                   D
Oh, ha-ah-ah, ah
A
Oh-ah, ha-ah-ah-ah

[Chorus]
Am               D/F#
I'm off the deep end, watch as I dive in
G        D       Em
I'll never meet the ground
Am                    D/F#
Crash through the surface, where they can't hurt us
G              D     Em
We're far from the shallow now

[Post-Chorus]
Am           D/F#
  In the sha-ha, shallow
G        D          Em
  In the sha-ha-sha-la-la-la-low
Am           D/F#
  In the sha-ha, shallow
G              D     Em
  We're far from the shallow now`;

/** Machine-compacted output of RAW_SHALLOW_UG_SAMPLE with Intro TAB; retained as regression test fixture for parser and compactor tests. */
export const COMPACTED_SHALLOW_BODY = `Shallow - Lady Gaga & Bradley Cooper

((
Standard tuning.
Capo 2
   Em7  D/F#  G     C    Cadd9  D     Am   Em   Bm   A
e|(3)--(2)--(3)--(0)--(0)---2----0----0----2----0----|
B|-3----3----3----1----3----3----1----0----3----2----|
G|-0----2----0----0----0----2----2----0----4----2----|
D|-2----0----0----2----2----0----2----2----4----2----|
A|-2---(0)--(2)---3----3---------0----2----2----0----|
E|-0----2----3------------------------0--------------|
))

1. Intro
{
   Em7             D/F#             G
e|---------------3----------------2----------------3-------------------------|
B|---------3---3---3--------3---3---3--------3---3---3-----------------------|
G|-------0---0------------2---2------------0---0-----------------------------|
D|-----2----------------0----------------0-----------------------------------|
A|---2-----------------------------------------------------------------------|
E|-0------------------2----------------3-------------------------------------|
}
{
   C                G                D
e|---------------0----------------3----------------2h3p2---------------------|
B|---------1---1---1--------3---3---3--------3---3-------3-------------------|
G|-------0---0------------0---0------------2---2-----------2-----------------|
D|-----2----------------0----------------0-----------------------------------|
A|---3-----------------------------------------------------------------------|
E|--------------------3------------------------------------------------------|
}

2. Verse 1
[ Em7 - D/F# - G ]
[ Em7 - D/F# - G | C - G - D ]
  Tell me something, girl
  Are you happy in this modern world?
  Or do you need more?
  Is there something else you're searchin' for?

3. Refrain
[ Em7 - D/F# - G | C - G - D ]
  I'm fallin'
  In all the good times I find myself longin' for change
C                    G     D    Em7  D/F#  G
  And in the bad times I fear myself

4. Verse 2
[ Em7 - D/F# - G | C - G - D ]
  Tell me something, boy
  Aren't you tired tryin' to fill that void?
  Or do you need more?
  Ain't it hard keepin' it so hardcore?

5. Refrain
[ Em7 - D/F# - G | C - G - D ]
  I'm fallin'
  In all the good times I find myself longin' for change
C                    G     D
  And in the bad times I fear myself

6. Chorus
[ Am - D/F# | G - D - Em ]
I'm off the deep end, watch as I dive in
I'll never meet the ground
Crash through the surface, where they can't hurt us
We're far from the shallow now

7. Post-Chorus
[ Am - D/F# | G - D - Em ]
  In the sha-ha, shallow
  In the sha-ha-sha-la-la-la-low
  In the sha-ha, shallow
  We're far from the shallow now

8. Bridge
[ Bm - D | A - Em ]
Oh, ha-ah-ah, ah
Oh-ah, ha-ah-ah-ah
Oh, ha-ah-ah, ah
Oh-ah, ha-ah-ah-ah

9. Chorus

10. Post-Chorus
`;

/** Curated starter song for new user library; features 9 clean sections with couplet chord loops without inline chord clutter. */
export const DEFAULT_SHALLOW_BODY = `Shallow - Lady Gaga & Bradley Cooper

((
Standard tuning.
Capo 2
   Em7  D/F#  G     C    Cadd9  D     Am   Em   Bm   A
e|(3)--(2)--(3)--(0)--(0)---2----0----0----2----0----|
B|-3----3----3----1----3----3----1----0----3----2----|
G|-0----2----0----0----0----2----2----0----4----2----|
D|-2----0----0----2----2----0----2----2----4----2----|
A|-2---(0)--(2)---3----3---------0----2----2----0----|
E|-0----2----3------------------------0--------------|
))

1. Verse 1
[ Em7 - D/F# - G | C - G - D ]
  Tell me something, girl
  Are you happy in this modern world?
  Or do you need more?
  Is there something else you're searchin' for?

2. Refrain
[ Em7 - D/F# - G | C - G - D ]
  I'm fallin'
  In all the good times I find myself longin' for change
  And in the bad times I fear myself

3. Verse 2
[ Em7 - D/F# - G | C - G - D ]
  Tell me something, boy
  Aren't you tired tryin' to fill that void?
  Or do you need more?
  Ain't it hard keepin' it so hardcore?

4. Refrain
[ Em7 - D/F# - G | C - G - D ]
  I'm fallin'
  In all the good times I find myself longin' for change
  And in the bad times I fear myself

5. Chorus
[ Am - D/F# | G - D - Em ]
I'm off the deep end, watch as I dive in
I'll never meet the ground
Crash through the surface, where they can't hurt us
We're far from the shallow now

6. Post-Chorus
[ Am - D/F# | G - D - Em ]
  In the sha-ha, shallow
  In the sha-ha-sha-la-la-la-low
  In the sha-ha, shallow
  We're far from the shallow now

7. Bridge
[ Bm - D | A - Em ]
Oh, ha-ah-ah, ah
Oh-ah, ha-ah-ah-ah
Oh, ha-ah-ah, ah
Oh-ah, ha-ah-ah-ah

8. Chorus

9. Post-Chorus
`;

export const RAW_ROTTERDAM_UG_SAMPLE = `[Verse 1]
        C            Fmaj7
And the women tug their hair

            Cmaj7      Fmaj7
Like they're trying to prove it won't fall out

C  Fmaj7  Cmaj7  Fmaj7

   C              Fmaj7
And all the men are gargoyles

      Cmaj7     Fmaj7
Dipped long in Irish stout

C  Fmaj7  Cmaj7  Fmaj7

[Pre-Chorus]
G
The whole place is pickled

G                                 Am
The people are pickles for sure

   G
And no-one knows if they've done more here

           C                       E7
Than they ever would do in a jar

[Chorus]
                  Am              C            Am              C
This could be Rotterdam or anywhere, Liverpool or Rome,

      Am              C            D7         G7
'Cause Rotterdam is anywhere, anywhere alone,

G7
Anywhere alone

[Verse 2]
        C                  Fmaj7
And the everyone is blonde

        Cmaj7            Fmaj7
And everyone is beautiful

C  Fmaj7  Cmaj7  Fmaj7

           C                   Fmaj7
And when blondes and beautiful are multiple

      Cmaj7                  Fmaj7
They become so dull and dutiful

[Pre-Chorus]
G
The whole place is pickled

G                                 Am
The people are pickles for sure

   G
And no-one knows if they've done more here

           C                       E7
Than they ever would do in a jar

[Chorus]
                  Am              C            Am              C
This could be Rotterdam or anywhere, Liverpool or Rome,

      Am              C            D7         G7
'Cause Rotterdam is anywhere, anywhere alone,

G7
Anywhere alone`;

export const COMPACTED_ROTTERDAM_BODY = `Rotterdam (Or Anywhere) - The Beautiful South

1. Verse 1
[ C - F ]
And the women tug their hair
Like they're trying to prove it won't fall out
And all the men are gargoyles
Dipped long in Irish stout

2. Pre-Chorus
   G
The whole place is pickled
The people are pickles for sure
And no-one knows if they've done more here
                          E
Than they ever would do in a jar

3. Chorus
[ Am - C ]
This could be Rotterdam or anywhere, Liverpool or Rome,
                                D7        G7
'Cause Rotterdam is anywhere, anywhere alone,
G7
Anywhere alone

4. Verse 2
[ C - F ]
And the everyone is blonde
And everyone is beautiful
And when blondes and beautiful are multiple
They become so dull and dutiful

5. Pre-Chorus

6. Chorus
`;

export const SAMPLE_SONGS: SongItem[] = [
  {
    id: 'song-shallow',
    shortName: 'Shallow (capo 2)',
    body: DEFAULT_SHALLOW_BODY,
    rawSource: RAW_SHALLOW_UG_SAMPLE,
    lastMode: 'chain',
    chunkSize: 4,
    customHighlights: ['0:0:2', '0:2:4', '4:0:3', '4:2:0'],
    scaffoldEveryNLines: 2,
    updatedAt: 1730950000000,
  },
  {
    id: 'song-knockin',
    shortName: "Knockin'",
    body: `Knockin' on Heaven's Door - Bob Dylan

((
Standard tuning.
No capo.
G   320003
D   xx0232
Am7 x02010
C   x32010
))

1. Intro
[ G - D - Am7 | G - D - C ]

2. Verse 1
[ G - D - Am7 | G - D - C ]
Mama, take this badge off of me
I can't use it anymore
It's gettin' dark, too dark to see
I feel I'm knockin' on heaven's door

3. Chorus
[ G - D - Am7 | G - D - C ]
Knock, knock, knockin' on heaven's door
Knock, knock, knockin' on heaven's door
Knock, knock, knockin' on heaven's door
Knock, knock, knockin' on heaven's door

4. Verse 2
[ G - D - Am7 | G - D - C ]
Mama, put my guns in the ground
I can't shoot them anymore
That long black cloud is comin' down
I feel I'm knockin' on heaven's door

5. Chorus

6. Outro
[ G - D - Am7 | G - D - C ]
Ooh, ooh, ooh
Ooh, ooh, ooh
`,
    lastMode: 'chain',
    chunkSize: 4,
    customHighlights: ['1:0:3', '3:0:3'],
    scaffoldEveryNLines: 2,
    updatedAt: 1730940000000,
  },
  {
    id: 'text-sonnet-18',
    shortName: 'Shakespeare - Sonnet 18',
    body: `Sonnet 18 - William Shakespeare

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
`,
    lastMode: 'chain',
    chunkSize: 2,
    customHighlights: ['0:0:3', '1:0:4', '2:0:2', '3:0:5'],
    scaffoldEveryNLines: 2,
    updatedAt: 1730930000000,
  },
];
