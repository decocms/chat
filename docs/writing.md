# Writing rules

Write all Markdown files in this repository in Simplified Technical English (ASD-STE100). Follow the rules below. We use approximately 80% of the standard: the rules for sentences are mandatory. The approved dictionary is not mandatory. You can use technical names and the names in the code.

## Words

1. Use one word for one meaning. Use the same word each time.
2. Use the name that the code uses. Write code names exactly, in backticks.
3. Use simple verbs. Write "start", not "kick off". Write "make sure", not "ensure that it is the case".
4. Do not use slang, jokes or idioms.
5. Use "must" for a rule. Do not use "should" for a rule.

## Sentences

1. Write a maximum of 20 words in an instruction.
2. Write a maximum of 25 words in a description.
3. Write one instruction in each sentence.
4. Use the active voice. Write "The Worker refuses the request", not "The request is refused".
5. Use the imperative for instructions: "Run `bun run check`."
6. Use the present, past or future tense. Do not use other tenses.
7. Put a condition before its instruction: "If the check fails, stop."
8. Do not use the "-ing" form as a noun or an adjective when another word is possible.

## Paragraphs and structure

1. Write a maximum of 6 sentences in a paragraph.
2. Write procedures as numbered steps. Write one action in each step.
3. Use tables for facts that have the same structure.
4. Put the most important information first.
5. Write warnings before the step that they apply to.

## Scope of documents

1. Write global rules in `AGENTS.md`. Keep that file short.
2. Write design, stack, workflow and folder information in `docs/`.
3. Do not write a document for each feature. The code is the reference for features.
4. If a change makes a document wrong, update the document in the same commit.
5. Do not keep reports, plans or evidence in the repository. Put them in the project room or in the pull request.
6. Write Markdown only in these files: `README.md`, `AGENTS.md`, `docs/*.md`, `herdr-plugin/README.md`, the plugin prompt files (`claude-plugin/commands/*.md`, `claude-plugin/skills/*/SKILL.md`) and `.github/pull_request_template.md`.
