import { initiateNewProject } from '@/repositories/project_repo';
import { MaterialIcons } from '@expo/vector-icons';
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
	const [aspectRatio, setAspectRatio] = useState<'4:3' | '16:9'>('16:9');
	const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('back');

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
		<View style={{ flex: 1, backgroundColor: 'black' }}>
			<CameraView
				ref={cameraRef}
				ratio={aspectRatio}
				style={{ flex: 1, bottom: 40}}
				facing={cameraFacing}
				onCameraReady={() => setReady(true)}
			/>
			<View style={styles.rightControlContainer}>
				<TouchableOpacity
					style={styles.circleButton}
					onPress={() => setAspectRatio(prev => prev === '4:3' ? '16:9' : '4:3')}
				>
					<MaterialIcons name="aspect-ratio" size={24} color="white" />
				</TouchableOpacity>
				<TouchableOpacity
					style={styles.circleButton}
					onPress={() => setCameraFacing(prev => prev === 'front' ? 'back' : 'front')}
				>
					<MaterialIcons name="flip-camera-android" size={24} color="white" />
				</TouchableOpacity>
			</View>
			<View style={styles.bottomControlsContainer}>
				<TouchableOpacity
					onPress={() => router.back()}
					style={[styles.shutter, { backgroundColor: '#666' }]}
				>
					<Text style={{ color: 'white', fontWeight: '700' }}>X</Text>
				</TouchableOpacity>
				<TouchableOpacity disabled={!ready} onPress={takePhoto} style={[styles.shutter]}>
					<Text style={{ color: 'white', fontWeight: '700' }}>Capture</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	bottomControlsContainer: {
		position: 'absolute',
		bottom: 70, left: 0,
		right: 0,
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
		gap: 12
	},
	rightControlContainer: {
		position: 'absolute',
		top: 60,
		right: 20,
		flexDirection: 'column',
		gap: 12
	},
	circleButton: {
		width: 48,
		height: 48,
		borderRadius: 24,
		backgroundColor: 'rgba(0,0,0,0.4)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	shutter: {
		backgroundColor: '#1e90ff',
		paddingHorizontal: 24,
		paddingVertical: 12,
		borderRadius: 24
	},
	center: {
		flex: 1,
		alignItems: 'center',
		justifyContent:
		'center'
	},
});
