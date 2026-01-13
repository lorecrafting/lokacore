# Generate Study Guide PDF

Regenerate the Loka System Study Guide PDF from markdown.

## Command

```bash
cd /Users/raymondluong/dev/lokacore/docs && \
pandoc LOKA_SYSTEM_STUDY_GUIDE.md \
  -o LOKA_SYSTEM_STUDY_GUIDE.pdf \
  --pdf-engine=xelatex \
  --metadata title="Loka System Study Guide" \
  --toc \
  --toc-depth=3
```

## Prerequisites

- `pandoc` installed (`brew install pandoc`)
- `xelatex` available (via MacTeX or BasicTeX)

## Notes

- Unicode box-drawing characters may show warnings but PDF will generate
- Output file: `docs/LOKA_SYSTEM_STUDY_GUIDE.pdf`
- Includes table of contents up to depth 3

## When to Use

Run this command after updating `docs/LOKA_SYSTEM_STUDY_GUIDE.md` to regenerate the PDF.
