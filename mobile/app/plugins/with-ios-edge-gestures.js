// Defers iOS's bottom-edge system gestures (Reachability, home / app switcher) so the first
// vertical drag of the footer joystick goes to the app. React Native's root view controller is a
// bare UIViewController made in ReactNativeDelegate.createRootViewController; it is the window's
// only view controller, so its override is the one iOS reads (no child forwarding needed), and the
// value never changes (no setNeedsUpdateOfScreenEdgesDeferringSystemGestures needed).
// ponytail: replaces Expo's reactDelegateHandlers hook for the root VC; none is installed today.
const { withAppDelegate } = require('expo/config-plugins');

const MARKER = '  // Extension point for config-plugins\n';
const OVERRIDE = `${MARKER}
  override func createRootViewController() -> UIViewController {
    return BottomEdgeViewController()
  }
`;
const CLASS = `
// Defers the bottom-edge system gestures so the first swipe goes to the app.
class BottomEdgeViewController: UIViewController {
  override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .bottom }
}
`;

function patchAppDelegate(src) {
  if (src.includes('BottomEdgeViewController')) return src;
  if (!src.includes(MARKER)) {
    throw new Error(
      'with-ios-edge-gestures: AppDelegate.swift no longer matches the Expo 57 template; update the plugin',
    );
  }
  return src.replace(MARKER, OVERRIDE) + CLASS;
}

module.exports = (config) =>
  withAppDelegate(config, (c) => {
    c.modResults.contents = patchAppDelegate(c.modResults.contents);
    return c;
  });
