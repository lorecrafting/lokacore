import { Text, View } from 'react-native';
const KERNEL_ID = 'none';

export default function App() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Loka · {KERNEL_ID}</Text>
    </View>
  );
}
