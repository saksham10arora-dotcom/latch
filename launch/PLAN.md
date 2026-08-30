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

**Star count is a bad proxy.** Every list below was checked on its merge history
and its own stated rules, not its badge. The biggest one is dead.

### Submitted

| Repo | Stars | Last merged | PR |
|---|---|---|---|
| [xyNNN/awesome-chrome](https://github.com/xyNNN/awesome-chrome) | 117 | Aug 2026 | [#88](https://github.com/xyNNN/awesome-chrome/pull/88) |
| [linsa-io/chrome-extensions](https://github.com/linsa-io/chrome-extensions) | 482 | Mar 2026 | [#70](https://github.com/linsa-io/chrome-extensions/pull/70) |
| [studyarena-com/awesome-study-tools](https://github.com/studyarena-com/awesome-study-tools) | 6 | active | [#2](https://github.com/studyarena-com/awesome-study-tools/pull/2) |
| [jcanfield/awesome-digital-wellbeing](https://github.com/jcanfield/awesome-digital-wellbeing) | 4 | May 2025 | [#4](https://github.com/jcanfield/awesome-digital-wellbeing/pull/4) |

The two small ones are worth roughly zero stars today, but they are the only
lists whose actual subject is this. Early entries in a list that grows are worth
more later than a late entry in a list that does not.

### Blocked, not rejected

| Repo | Stars | Why |
|---|---|---|
| [themeselection/best-chrome-extensions](https://github.com/themeselection/best-chrome-extensions) | 572 | Its format demands a Chrome Web Store URL. Submit the day that listing is live. |

### Do not submit

| Repo | Stars | Why |
|---|---|---|
| jyguyomarch/awesome-productivity | 3.3k | Dead. Last merge May 2023, 189 PRs open. |
| ProductivityDirectory/awesome-productivity-tools | 166 | Dead. Last merge Jan 2024. |
| altstackHQ/altstack-data | 322 | Requires self-hostable on user infrastructure, and excludes projects with no users. A browser extension fails both. |
| diegoleme/awesome-open-source-alternatives | 480 | Organised by famous SaaS app. No focus or blocker category exists, and adding a top-level one for a new project is a stretch. |
| awesome-selfhosted | 316k | For self-hosted services. A browser extension gets rejected, and a rejected PR on a big list is worse than no PR. |

Line used, adapted to each list's own format:

```markdown
- [Latch](https://github.com/saksham10arora-dotcom/latch) - Keeps a YouTube lecture in full screen; Escape does nothing and leaving takes a deliberate hold.
```

Every open PR says plainly that the link can move to the Web Store page later,
and the study-tools one is upfront that the project is new, which is a criterion
that list states explicitly.

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
