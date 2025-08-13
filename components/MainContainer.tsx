import { View } from 'react-native';

export default function MainContainer({ children }: { children: React.ReactNode }) {
    return <View
        style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 40 }}>
            {children}
    </View>;
}