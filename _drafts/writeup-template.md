---
title: "Your writeup title"
date: 2026-01-01
category: project        # project  or  ctf
tags: [appsec, python]
summary: One or two sentences. Shown on the blog index, the home page, and in link previews.
---

<!--
  HOW TO PUBLISH
  1. Copy this file into _posts/ and name it YYYY-MM-DD-short-title.md
     (for example _posts/2026-10-20-safebuyr-sql-injection.md).
  2. Fill in the front matter above and replace everything below.
  3. Commit and push. GitHub Pages builds it; the post appears at /blog/short-title/.
  Files in _drafts/ are never published, so this template stays private.
-->

Open with the problem in two or three sentences: what the target was and what you set out to do.

## Recon

Regular paragraphs are Markdown. Use `inline code` for commands, paths and payloads.

```bash
nmap -sV -p- 10.10.10.10
```

## Finding the bug

Code blocks are syntax highlighted when you name the language:

```python
query = "SELECT * FROM users WHERE name = ?"
cursor.execute(query, (username,))
```

> Use a blockquote for a callout: a key insight, a warning, or the lesson.

Images go in `blog/img/` and are referenced like this:

![What the screenshot shows](/blog/img/example.png)

## Fix

| Before | After |
| ------ | ----- |
| String-built SQL | Parameterized query |

## Takeaways

- What you'd do differently
- What the reader should check in their own code
