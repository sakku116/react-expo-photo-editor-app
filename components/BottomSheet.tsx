import BS, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import React, { ReactNode, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

type SlidingMenuProps = {
  children: ReactNode;
};

export default function BottomSheet({ children }: SlidingMenuProps) {
  const snapPoints = useMemo(() => ['15%', '40%'], []);
  const data = useMemo(() => React.Children.toArray(children), [children]);

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 1000, elevation: 10 }]} pointerEvents="box-none">
      <BS
        index={1}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        enableContentPanningGesture={false}
        containerStyle={{ zIndex: 100 }}
        style={{ elevation: 10 }}>
        <BottomSheetFlatList
          data={data}
          keyExtractor={(_, idx) => String(idx)}
          renderItem={({ item }) => <View style={{ marginBottom: 12 }}>{item as any}</View>}
          contentContainerStyle={styles.content}
        />
      </BS>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
  },
});
