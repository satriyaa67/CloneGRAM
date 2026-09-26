# Competitor review (2026-09-26)

Goal: find features competitors ship that CloneGRAM lacks, and keep only those that fit our boundaries and our "simple panel" rule. Result: Phase 6 in [`MVP-PLAN.md`](MVP-PLAN.md).

## Who we looked at

| Product | Type | Notable features |
| --- | --- | --- |
| [Auto Forward Messages](https://autoforwardmessages.com/features.html) | Userbot forwarder | Type filters, keyword allow/block lists, link/hashtag filters, find-replace, remove lines, header/footer, delay and spread, active hours, duplicate block, edit/delete mirroring, image watermark, translation, settings backup |
| [Neon Forward](https://neonforward.io/docs) | Userbot forwarder | Same core set, "cleaner" (strip URLs/mentions/captions), sender tag, web dashboard |
| [Junction Bot](https://www.junctionbot.io/) | Userbot + bot | Pre-moderation (manual approval), presets applied to many rules, AI digest/rewrite, duplicate-by-meaning, link replacement, watermark |
| [ForwardBuddy](https://weego.tech/docs/forwardbot/index.html) | Bot forwarder | Keyword replacement, delay, header/footer, length caps, photo watermark |
| [Posto](https://www.grambots.com/bots/posto) | Posting bot | Content plan, bulk upload, per-channel templates (buttons, signature, watermark), recurring posts, ad posts with auto-delete |
| [Posterium](https://posterium.pro/) | Posting bot | Auto-signature, inline buttons, auto-pin, protect from copying, auto-delete, service message cleanup |
| [Postly](https://postly.ai/telegram) / [posterly](https://www.poster.ly/telegram-scheduler) | Multi-network schedulers | Silent delivery, pin, link preview control, URL buttons, retries and failure notifications |
| [QuickQueue](https://botfindr.com/app/quickqueue_bot) | Queue bot | Post every N hours from a queue, cancel/reschedule, auto signature, text filters, history and failed list |

## What we already have or planned

Rights-checked sources, protected-content skip, review queue, one-click publish, cancel/restore (Phase 1.1); caption edit, fixed footer, watermark, approval (Phase 2); scheduling, retries, rate limits (Phase 3); opt-in campaigns (Phase 4).

## Gaps adopted (Phase 6)

Filters, text rules, automatic mode with delay/spacing/active hours, duplicate guard, edit mirroring, one-to-many destinations, publish options (silent, pin, protect, link preview, buttons), content calendar with auto-delete, presets and settings backup, failure alerts, optional AI rewrite/translation.

## Gaps rejected

Userbot/MTProto sessions, private or closed sources, copying protected content, "click to reveal" bypass, removing others' watermarks, "uniqueness" tricks against copyright complaints, auto-joining chats. These conflict with Telegram's terms and our product rules in `CLAUDE.md`. Delete mirroring is also out: bots do not receive deletion updates.

## Keeping it simple

One per-source **Kurallar** drawer, four collapsed groups, everything off by default, a live before/after preview. The main navigation stays at five items.
