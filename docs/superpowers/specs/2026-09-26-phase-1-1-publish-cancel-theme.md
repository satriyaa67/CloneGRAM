# Phase 1.1: manual publish, cancel, test post, theme

Date: 2026-09-26 · Trigger: product owner's live test

## Problem

- The owner registered a source and his own channel as destination, but nothing appeared in the destination. Phase 1 only collected posts; there was no publish action. (The "welcome messages" admin toggle he could not enable is unrelated; the bot needs "Post messages" in channels, which registration already verifies.)
- No way to drop a queued post.
- Wants a light/dark theme and a brand watermark visible in screenshots.

## Design

- `POST /api/content/:id/publish`: human-triggered. Re-checks that the source is still an active, rights-confirmed source and that the destination is registered. Resolves the album (same source + `media_group_id`), atomically claims actionable rows (`received`/`failed` -> `publishing`, `UPDATE ... RETURNING`), then calls `copyMessage` (single) or `copyMessages` (album, ids ascending, album grouping kept). Success -> `published` with destination chat and first message id; Telegram error -> `failed` with the description, retryable. Protected (`skipped`) items are refused before any Telegram call; Telegram itself also refuses to copy protected messages.
- `POST /api/content/:id/cancel|restore`: `received|failed -> cancelled`, `cancelled -> received`, whole album.
- `POST /api/chats/:chatId/test`: silent `sendMessage` to a registered destination only.
- Migration `0003` rebuilds `content_items` to extend the status CHECK and add `published_chat_id`, `published_message_id`, `published_at`, `last_error`, `updated_at`; tested against data created by 0001/0002.
- Panel: albums shown as one row; row actions "Hedefe gönder" / "Tekrar dene" / "İptal" / "Geri al"; destination chooser when several; filters Bekleyen / Gönderilemedi / Yayımlanan / İptal / Atlanan. Settings > Görünüm: Açık / Koyu / Sistem (localStorage, applied before paint by `theme.js`). `body::before` shows `assets/clonegram-watermark.svg` at 5% (light) / 7% (dark) opacity, `pointer-events: none`.

## Out of scope

Automatic publishing, schedules, caption/footer edits and watermarking the published media (Phases 2-3).
