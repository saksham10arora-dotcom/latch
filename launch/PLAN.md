# Distribution plan

Ordered by leverage. The awesome-list PRs are the ones that compound, so they go
first once there is an install link to point at.

## 0. Prerequisite

**Chrome Web Store listing live.** Everything below sends people somewhere to
install from, and "clone this repo and enable developer mode" loses roughly
everyone. `store/LISTING.md` has the copy and the permission justifications;
`bash scripts/package.sh` builds the upload. One-time $5 registration, review is
usually a few days.

Until then, run only the **Show HN** and the **X thread**, which tolerate a
GitHub link.

---

## 1. Awesome lists, the star firehoses

One PR each, adding a single line. These are the highest leverage items here and
the slowest to pay off, so open them early.

| Repo | Stars | Where it goes | Fit |
|---|---|---|---|
| [jyguyomarch/awesome-productivity](https://github.com/jyguyomarch/awesome-productivity) | 3.3k | Tools → Focus | **Best fit.** General productivity, actively curated. |
| [themeselection/best-chrome-extensions](https://github.com/themeselection/best-chrome-extensions) | 572 | Productivity | Chrome-specific, takes new entries. |
| [linsa-io/chrome-extensions](https://github.com/linsa-io/chrome-extensions) | 482 | Productivity | Chrome-specific. |
| [ProductivityDirectory/awesome-productivity-tools](https://github.com/ProductivityDirectory/awesome-productivity-tools) | 166 | Focus | Small but very low friction. |
| [xyNNN/awesome-chrome](https://github.com/xyNNN/awesome-chrome) | 117 | Productivity | Small, quiet, cheap to try. |

**Do not** submit to `awesome-selfhosted` (316k stars). It is for self-hosted
services and a browser extension will be rejected. A rejected PR on a big list is
worse than no PR.

Suggested line, matching the house style of most of these:

```markdown
- [Latch](https://github.com/saksham10arora-dotcom/latch) - Pins a YouTube lecture in full screen; Escape does nothing and leaving takes a deliberate hold. `MIT`
```

Read each list's CONTRIBUTING first. Most want alphabetical order and a specific
dash character, and getting that wrong is the usual reason a one-line PR sits.

---

## 2. Reddit

Post the **GIF**, not a link. Every one of these subreddits ranks image posts
far above link posts, and the GIF is the whole pitch.

| Subreddit | Members | Angle | Notes |
|---|---|---|---|
| r/GetDisciplined | 1.5M | "I got tired of Escape working" | Best fit by far. Loves self-built tools. |
| r/ADHD | 2M | Focus tooling | **Read the rules first.** Several ban self-promo outright. |
| r/productivity | 3M | The lock screen argues with you | Link posts get buried; lead with the GIF. |
| r/chrome_extensions | 30k | Keyboard Lock API | Small, technical, receptive. |
| r/SideProject | 500k | Built it in a night | Friendly, low bar. |
| r/opensource | 300k | MIT, audited escape surface | ESCAPES.md is the hook here. |

Do not post all six the same day. Two, a week apart, and reply to every comment
on the first before opening the second.

---

## 3. Hacker News

**Show HN: Latch, a Chrome extension where Escape does not exit full screen**

The technical hook is the Keyboard Lock API, which most people do not know
exists. The second hook is `ESCAPES.md`: HN rewards a project that documents its
own limits, and punishes one that overstates them.

Post Tuesday to Thursday, 8 to 10am ET. Be in the thread for the first two hours
or it dies.

---

## 4. X thread

Terminal screenshots plus the GIF. The arc drawing is the thing people stop
scrolling for.

Draft in `launch/POSTS.md`. Link it from your GitHub profile README.

---

## 5. Directories

- **AlternativeTo** as an alternative to Cold Turkey, Freedom and StayFocusd.
  Free listing, steady long-tail traffic.
- **Product Hunt**, but only once the Web Store link is live. A PH launch that
  sends people to a GitHub clone wastes the one shot you get.

---

## What to say when someone asks "why not just use willpower"

They will. The answer is in the README already: the extension is not a claim
about discipline, it is a claim about cost. Holding Escape for two seconds and
then a button for eight is still possible, it just is not a reflex. Say that
plainly rather than defending it.
