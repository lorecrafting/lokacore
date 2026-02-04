# Post to Social Media

Prepare and fill in social media posts for the specified platform.

## Usage

```
/post-social <platform>
```

Where `<platform>` is one of:
- `twitter` - Weekly thread or quick update
- `itch` - Weekly devlog post
- `kofi` - Bi-weekly supporter update
- `all` - Show what's scheduled for today

## Instructions

### 1. Determine Content Source

Read the latest content from `docs/devlog/BLOG_POSTS.md`:
- Find the "READY TO POST" section for pre-written content
- Or generate fresh content based on recent git log and changes

### 2. Platform-Specific Workflow

#### For Twitter (`/post-social twitter`)

1. Use Chrome extension to navigate to https://twitter.com/compose/tweet
2. Read the Twitter thread content from BLOG_POSTS.md
3. Fill in the first tweet using `form_input` or `computer` tool
4. Tell user: "Tweet 1 ready. Click Post, then I'll fill in Tweet 2 as a reply."
5. Wait for user confirmation, then continue with each tweet in thread

#### For itch.io (`/post-social itch`)

1. Ask user for their itch.io game URL if not known
2. Navigate to: `https://itch.io/dashboard/game/[game-id]/devlog`
3. Click "Create devlog" or equivalent button
4. Fill in:
   - Title: From BLOG_POSTS.md (e.g., "Devlog #2: Making It Feel Real")
   - Body: Full markdown content from the itch.io section
5. Tell user: "Devlog ready for review. Edit if needed, then click Publish."

#### For Ko-fi (`/post-social kofi`)

1. Navigate to: https://ko-fi.com/manage/posts
2. Click to create new post
3. Fill in:
   - Content: From Ko-fi section in BLOG_POSTS.md
4. Tell user: "Ko-fi post ready. Review and click Post."

### 3. Content Generation (if no pre-written content)

If BLOG_POSTS.md doesn't have fresh content:

1. Run the equivalent of `/devlog-today` to get recent work
2. Generate platform-appropriate content:
   - **Twitter**: 280-char hook + key insight
   - **itch.io**: Full narrative with headers
   - **Ko-fi**: Checklist format with emojis

### 4. Post-Posting

After user confirms posting:
1. Ask if they want to update BLOG_POSTS.md to mark content as posted
2. Add a "Posted: [date]" note to the content section

## Example Session

```
User: /post-social twitter

Claude: Let me prepare your Twitter post.

[Reads BLOG_POSTS.md, finds latest content]
[Opens Twitter compose via Chrome extension]
[Fills in first tweet]

Claude: Tweet 1 is ready:

"🧵 Week 5 of building Loka, my text-based RPG engine. Theme: immersion..."

I've filled this into the compose box. Review it, edit if needed, then click Post.
Let me know when you're ready for Tweet 2.
```

## Schedule Reference

| Day | Time (HST) | Platform |
|-----|------------|----------|
| Tuesday | 7:00 AM | Twitter |
| Thursday | 7:00 AM | Twitter |
| Sunday | 5:00 PM | itch.io |
| Sunday | 5:30 PM | Ko-fi (bi-weekly) |
