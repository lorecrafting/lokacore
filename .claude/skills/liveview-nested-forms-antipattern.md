# LiveView Nested Forms Anti-Pattern

## Trigger Conditions
Use this skill when:
- A LiveView form submission shows URL params in browser address bar
- `phx-submit` event never fires to the server
- Form appears to submit but nothing happens
- Inner form inside another form doesn't work

## The Problem

**HTML does not support nested forms.** When you have:

```html
<form phx-change="outer_change">
  <input name="outer_field" />

  <!-- BROKEN: This inner form will not work correctly -->
  <form phx-submit="inner_submit">
    <input name="inner_field" />
    <button type="submit">Submit</button>
  </form>
</form>
```

Browser behavior is undefined. Common symptoms:
1. Inner form submission gets swallowed or redirects with URL params
2. `phx-submit` event never reaches LiveView
3. No error messages - silent failure

## The Solution

### Option 1: Close outer form before inner form (Recommended)

```heex
<form phx-change="outer_change">
  <input name="outer_field" />
</form>

<!-- Now this works - not nested -->
<form phx-submit="inner_submit">
  <input name="inner_field" />
  <button type="submit">Submit</button>
</form>
```

### Option 2: Convert inner form to button-based

```heex
<form phx-change="outer_change">
  <input name="outer_field" />

  <!-- Use phx-click instead of form -->
  <select id="direction" name="direction">...</select>
  <input id="destination" name="destination" />
  <button type="button" phx-click="add_exit"
          phx-value-direction={...} phx-value-to={...}>
    Add Exit
  </button>
</form>
```

### Option 3: Use JavaScript to read form values

```javascript
// In a hook
this.el.querySelector('button').addEventListener('click', () => {
  const direction = this.el.querySelector('#direction').value
  const destination = this.el.querySelector('#destination').value
  this.pushEvent('add_exit', { direction, destination })
})
```

## Real Example: World Builder Inspector Panel

**Before (broken):**
```heex
<form phx-change="update_room_field">
  <!-- Identity section inputs -->
  <!-- Position section inputs -->

  <!-- Exits section with NESTED form - BROKEN -->
  <form phx-submit="add_exit">
    <select name="direction">...</select>
    <input name="to" />
    <button type="submit">Add Exit</button>
  </form>
</form>
```

**After (fixed):**
```heex
<form phx-change="update_room_field">
  <!-- Identity section inputs -->
  <!-- Position section inputs -->
</form>

<!-- Exits section OUTSIDE the form -->
<div class="exits-section">
  <!-- Display existing exits -->

  <form phx-submit="add_exit">
    <select name="direction">...</select>
    <input name="to" />
    <button type="submit">Add Exit</button>
  </form>
</div>
```

## Debugging Checklist

When a form isn't working:

1. [ ] Check browser address bar - do you see form params in URL?
2. [ ] Inspect DOM - is this form nested inside another `<form>` tag?
3. [ ] Search template for `<form` - count opening vs closing tags
4. [ ] Check parent components - does a wrapper add a form?

## Prevention

- Keep forms flat - never nest `<form>` inside `<form>`
- In Inspector-style panels, use one form per logical action
- Prefer `phx-click` with `phx-value-*` for simple actions
- Review component boundaries - forms in child components may nest

## Related Files

- `server/assets/js/hooks/` - Alternative JS-based approach

## References

- HTML Spec: Forms cannot be nested (https://html.spec.whatwg.org/#the-form-element)
- Phoenix LiveView forms: https://hexdocs.pm/phoenix_live_view/form-bindings.html
