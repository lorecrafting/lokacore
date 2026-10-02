// iOS 27 asserts at launch unless the app adopts the UIScene life cycle. Expo 57 ships the
// scene delegate (EXExpoAppSceneDelegate) but its prebuild template does not wire it up.
// Remove this plugin once the template does.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const CLASS = 'class AppDelegate: ExpoAppDelegate {';
const PROVIDER = 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {';
// The template's own window + startReactNative, matched exactly; the scene delegate does this instead.
const START = `
#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
`;

function patchAppDelegate(src) {
  const hasStart = src.includes(START);
  if (src.includes(PROVIDER) && !hasStart) return src;
  if (!src.includes(CLASS) || !hasStart) {
    throw new Error(
      'with-ios-scene: AppDelegate.swift no longer matches the Expo 57 template; update the plugin',
    );
  }
  return src.replace(CLASS, PROVIDER).replace(START, '');
}

module.exports = (config) =>
  withInfoPlist(
    withAppDelegate(config, (c) => {
      c.modResults.contents = patchAppDelegate(c.modResults.contents);
      return c;
    }),
    (c) => {
      c.modResults.UIApplicationSceneManifest = {
        UIApplicationSupportsMultipleScenes: false,
        UISceneConfigurations: {
          UIWindowSceneSessionRoleApplication: [
            {
              UISceneConfigurationName: 'Default',
              UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
            },
          ],
        },
      };
      return c;
    },
  );
