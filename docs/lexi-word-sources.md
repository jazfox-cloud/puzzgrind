# Lexi Daily word sources

Lexi Daily uses the English Speller Database (ESDB, formerly SCOWL) as the upstream source for
valid English guesses. PuzzGrind fixes the source to `rel-2026.02.25` at commit
`7e99edab8e32f9f9ea2b15f249ca8d4d67237410`; it does not follow the upstream default branch.

The build input is American English at ESDB size 60 and variant level 1. The offline preparation
tool excludes abbreviations, special categories, proper names/proper-case forms, words that are not
exactly five lowercase ASCII letters, flagged offensive entries, and reviewed noise. This source
list is used only to decide whether a guess is accepted. Daily answers are selected separately and
reviewed for fairness.

ESDB is maintained by Kevin Atkinson and contributors. Its copyright and permission notice is
preserved in [the third-party notice](../THIRD_PARTY_NOTICES.md) and
[`third_party/esdb/Copyright`](../third_party/esdb/Copyright).

No leaked Wordle answer list, `wordfreq`, or unverified third-party GitHub word list is used.
