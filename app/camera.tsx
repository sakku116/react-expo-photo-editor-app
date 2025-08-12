import { initiateNewProject } from '@/repositories/project_repo';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function CameraScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      if (!permission || !permission.granted) {
        const res = await requestPermission();
        if (!res.granted) {
          Alert.alert('Camera permission required', 'Please enable camera permission in settings.');
        }
      }
    })();
  }, [permission, requestPermission]);

  const takePhoto = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 1, base64: false });
      if (!photo?.uri) return;

      // Ensure proper path construction with document directory
      const newUri = `${FileSystem.documentDirectory}photo_${Date.now()}.jpg`.replace(/\/+/g, '/');

      try {
        // copy file to save image
        await FileSystem.copyAsync({
          from: photo.uri,
          to: newUri
        });

        // check if file exists
        const fileInfo = await FileSystem.getInfoAsync(newUri);
        if (!fileInfo.exists) {
          console.error('File copy failed from', photo.uri, 'to', newUri);
          Alert.alert('Error', 'Failed to save photo');
          return;
        }

        console.log('Successfully copied image to:', newUri);

        // initiate project
        const project = await initiateNewProject(newUri);

        router.replace({ pathname: '/editor', params: { projectId: project.id } });
      } catch (e) {
        console.error('File copy error:', e);
        Alert.alert('Error', 'Failed to process image');
      }
    } catch (e) {
      console.warn(e);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing={'back'}
        onCameraReady={() => setReady(true)}
      />
      <View style={styles.controls}>
        <TouchableOpacity disabled={!ready} onPress={takePhoto} style={styles.shutter}>
          <Text style={{ color: 'white', fontWeight: '700' }}>Capture</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={[styles.shutter, { backgroundColor: '#666' }]}>
          <Text style={{ color: 'white', fontWeight: '700' }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { position: 'absolute', bottom: 32, left: 0, right: 0, alignItems: 'center', gap: 12 },
  shutter: { backgroundColor: '#1e90ff', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
