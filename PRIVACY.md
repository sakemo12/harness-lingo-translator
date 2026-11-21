# Privacy

`harness-lingo-translator` is a DeepSeek Harness plugin with one display-layer function.

- **What leaves the browser:** only prose whose protected spans (code, paths, commands, URLs, identifiers, versions, hashes, numbers, product names) have been replaced by `⟦n⟧` placeholders.
- **Where it goes:** with the default **Custom service** backend, only to the local OpenAI-compatible endpoint configured in `baseUrl`. With the **System model** backend, the host calls its `llm` service with the newest `request/header` provider/model of the current session, sending a standalone JSON array of masked segments with **no conversation context and no model-side cache hints**. There is no relay, no telemetry, analytics, advertising or usage data sent to PerryLink; the plugin has no hosted service and no account.
- **What is stored:** the original text nodes stay in page memory for the restore action. Translated strings are cached in browser `localStorage` under `harness-lingo-translator:cache:v2` (600 entries max), and the host writes a per-workspace document at `~/.dsh/cache/harness-lingo-translator/<sha256(workspace)>.json` (5000-entry LRU, filtered by the translation config hash). Clearing site data or deleting that directory removes the cache. After the 1.14.0 rename, the old `dsh-translate:cache:v2` key and `~/.dsh/cache/dsh-translate/` are read once as a fallback; the new version writes only the new key and directory.
- **What is never written:** the session log, workspace files, and the DSH configuration. The transcript always keeps exactly what the model said.
- **Credentials:** the optional `apiKey` is stored in the profile configuration like any other plugin setting, sent only as a bearer header to `baseUrl`, and never returned by `status()` or included in an error message. The System model backend uses the host's own model credentials; the plugin neither reads nor copies them.
- **Removing the package** removes its code; it does not delete host logs, the cache directory, the model files you deployed, or files you created. Delete `~/.dsh/cache/harness-lingo-translator/` to remove cached translations.

This statement covers the npm package, not the DSH host or any other plugin in the profile.
