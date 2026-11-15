mode: unattended
output: {{specAbs}}
specTool: {{specTool}}
language: the language of the roadmap
roadmap: {{rmAbs}}
card: {{E}}
ownerNote:
A reader of this spec raised the questions below. Answer each one yourself by reading the code and the roadmap, never by asking the person. Edit the spec at {{specAbs}} so that it settles every question (a design paragraph, a ruling or a criterion detail), keeping the ruling ids already registered. Do not commit: the caller commits. One simple command per call: no heredoc, no loop, no && and no ;.
{{questions}}
The spec ends with a json data block in the spec/1 schema, which must stay valid: run node "{{specTool}}" check "{{specAbs}}" --roadmap "{{rmAbs}}" before you finish.
