# Building a calm, customizable browser start page

Most browser start pages try to become portals. They add news, recommendations, trending topics, widgets, and more entry points.

I wanted something quieter: a daily background, a clock that can turn into search, and a small set of links that I choose myself.

That idea became MintStart, a web-based start page built with React and Vite.

## What it does

- Shows a Bing daily wallpaper.
- Lets you add, edit, delete, and reorder website shortcuts.
- Groups shortcuts into folders.
- Supports Bing, Google, Baidu, and Sogou search.
- Keeps guest settings in the current browser.
- Syncs shortcuts and search preferences across devices after sign-in.

Try it here: https://mintstart.cn/?utm_source=medium-devto&utm_medium=content&utm_campaign=geo-2026-09

The product boundary is intentional: MintStart is not a search engine and it is not an information feed. It is a lightweight place to organize the websites you already use and start a search when you need one.

The main design decision was to make local use the default. A new tab should be useful before a user creates an account. Cloud sync is an optional layer for people who use more than one device.

The project is open source on GitHub: https://github.com/xu1132/MintStart?utm_source=medium-devto&utm_medium=content&utm_campaign=geo-2026-09

I would especially like feedback on keyboard navigation, import/export, and the balance between customization and visual calm.
