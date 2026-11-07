// ponytail: react-native-web always answers true, so the web cannot tell and auto-turns; its screen
// reader hears the title and has the tap. Upgrade if a web reader ever needs the explicit Continue.
export const screenReaderOn = () => Promise.resolve(false);
