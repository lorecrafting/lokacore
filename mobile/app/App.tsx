import { Text, View } from 'react-native';
import { KERNEL_ID } from '../authority/local-story';

export default function App() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Loka · {KERNEL_ID}</Text>
    </View>
  );
}
