# LiveView Modal Event Pattern

## Trigger
- Modal close buttons (Cancel, X) not responding to clicks
- `phx-click` events inside modals not firing
- Using `onclick="event.stopPropagation()"` on modal content

## Problem
LiveView uses **event delegation** - it attaches event listeners to the root LiveView element and relies on events bubbling up. Using `onclick="event.stopPropagation()"` on modal content prevents clicks from reaching LiveView's handler.

This is a common pattern in vanilla JS/React for preventing overlay clicks from closing the modal, but it **breaks all `phx-click` events inside the modal**.

## Symptoms
- Clicking Cancel/X buttons does nothing
- Clicks are visually registered (button highlights) but no action occurs
- Custom JS click listeners fire, but LiveView events don't
- `liveSocket.isConnected()` returns true (socket is fine)

## Wrong Pattern (Breaks LiveView)
```heex
<div class="modal-overlay" phx-click="close_modal">
  <div class="modal-content" onclick="event.stopPropagation()">
    <!-- phx-click events inside here WON'T WORK -->
    <button phx-click="close_modal">Cancel</button>
  </div>
</div>
```

## Correct Pattern (LiveView-Compatible)
```heex
<div class="modal-overlay">
  <div class="modal-content" phx-click-away="close_modal">
    <!-- phx-click events inside here WORK -->
    <button phx-click="close_modal">Cancel</button>
  </div>
</div>
```

## How `phx-click-away` Works
- Triggers the event when clicking **outside** the element
- Doesn't require stopPropagation
- Clicks inside the modal naturally don't trigger the close
- All `phx-click` events inside work normally

## Debugging Steps
1. Check if button clicks are registering: Add `addEventListener('click', ...)` to button
2. If JS events fire but LiveView doesn't: Look for `stopPropagation()` in parent chain
3. Verify modal is inside LiveView container: `button.closest('[data-phx-main]')`
4. Check liveSocket: `window.liveSocket.isConnected()`

## Test Code (Browser Console)
```javascript
// Add to button to verify clicks are reaching it
const btn = document.querySelector('button.btn-secondary');
btn.addEventListener('click', () => console.log('CLICK DETECTED'));

// Check for stopPropagation in parent chain
let el = btn;
while (el) {
  const onclick = el.getAttribute('onclick');
  if (onclick && onclick.includes('stopPropagation')) {
    console.log('Found stopPropagation on:', el);
  }
  el = el.parentElement;
}
```

## Related Files
- General pattern applicable to any LiveView modal component

## Version
- Phoenix LiveView 1.1.19
- Created: 2026-02-02
