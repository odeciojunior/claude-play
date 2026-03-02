## New Plugin Submission

**Plugin name:** `plugins/<name>/`

**What it does:** <!-- One sentence -->

### Checklist

- [ ] Plugin directory name matches `plugin.json` `name` field
- [ ] `plugin.json` has all required fields (name, description, version, author, license, keywords)
- [ ] Skills have YAML frontmatter with `name` and `description`
- [ ] `README.md` documents what the plugin does and how to use it
- [ ] No hardcoded absolute paths (using `${CLAUDE_PLUGIN_ROOT}` where needed)
- [ ] No sensitive data (API keys, credentials, tokens)
- [ ] License declared in `plugin.json`

### Testing

<!-- How did you test the plugin? e.g., "Installed via --plugin-dir and verified skill triggers correctly" -->
