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

## 1. Awesome lists

**Star count is a bad proxy.** Checked each list's merge history rather than its
badge, and the biggest one is dead.

| Repo | Stars | Last merged PR | Verdict |
|---|---|---|---|
| [jyguyomarch/awesome-productivity](https://github.com/jyguyomarch/awesome-productivity) | 3.3k | **May 2023**, 189 PRs open | Dead. Do not bother. |
| [ProductivityDirectory/awesome-productivity-tools](https://github.com/ProductivityDirectory/awesome-productivity-tools) | 166 | **Jan 2024** | Dead. |
| [themeselection/best-chrome-extensions](https://github.com/themeselection/best-chrome-extensions) | 572 | Mar 2026 | Alive, but **requires a Chrome Web Store URL**. Blocked until the listing is live. |
| [linsa-io/chrome-extensions](https://github.com/linsa-io/chrome-extensions) | 482 | Mar 2026 | Alive, accepts source links. **PR open: [#70](https://github.com/linsa-io/chrome-extensions/pull/70)** |
| [xyNNN/awesome-chrome](https://github.com/xyNNN/awesome-chrome) | 117 | **Aug 2026** | Most responsive of the lot. **PR open: [#88](https://github.com/xyNNN/awesome-chrome/pull/88)** |

**Do not** submit to `awesome-selfhosted` (316k stars). It is for self-hosted
services and a browser extension will be rejected. A rejected PR on a big list is
worse than no PR.

Line used, adapted to each list's own format:

```markdown
- [Latch](https://github.com/saksham10arora-dotcom/latch) - Keeps a YouTube lecture in full screen; Escape does nothing and leaving takes a deliberate hold.
```

Both open PRs offer to switch the link to the Web Store once that listing exists.
`themeselection` gets its PR then too, since its stated format demands a store URL.

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
