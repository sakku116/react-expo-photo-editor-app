import MainContainer from '@/components/MainContainer';
import Slider from '@react-native-community/slider';
import { Canvas, ColorMatrix, Group, ImageFormat, Paint, Image as SkImage, useCanvasRef, useImage } from '@shopify/react-native-skia';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomSheet from "../components/BottomSheet";
import { getProject, Project, PROJECTS_DIR } from '../repositories/project_repo';

function multiplyMatrices(a: number[], b: number[]) {
	const result = new Array(20).fill(0);

	for (let row = 0; row < 4; row++) {
		for (let col = 0; col < 5; col++) {
			let val = 0;
			for (let k = 0; k < 4; k++) {
				val += a[row * 5 + k] * b[k * 5 + col];
			}
			if (col === 4) {
				val += a[row * 5 + 4];
			}
			result[row * 5 + col] = val;
		}
	}
	return result;
}

function saturationMatrix(s: number) {
	const invSat = 1 - s;
	const R = 0.213 * invSat;
	const G = 0.715 * invSat;
	const B = 0.072 * invSat;
	return [
		R + s, G,     B,     0, 0,
		R,     G + s, B,     0, 0,
		R,     G,     B + s, 0, 0,
		0,     0,     0,     1, 0,
	];
}

function colorMatrix(
	brightness: number,
	contrast: number,
	exposure: number,
	saturation: number
) {
	const c = contrast + 1;
	const e = Math.pow(2, exposure);
	const s = c * e;
	const b = brightness * 0.5;

	const base = [
		s, 0, 0, 0, b,
		0, s, 0, 0, b,
		0, 0, s, 0, b,
		0, 0, 0, 1, 0,
	];

	const satMat = saturationMatrix(saturation);

	return multiplyMatrices(base, satMat);
}


export default function Editor() {
	const router = useRouter();
	const params = useLocalSearchParams<{ projectId?: string }>();

	// load project
	const [project, setProject] = useState<Project | null>(null);
	const [loadingProject, setLoadingProject] = useState(true);
	React.useEffect(() => {
		let mounted = true;
		(async () => {
			try {
				if (!params.projectId) {
					if (mounted) setProject(null);
					return;
				}
				const p = await getProject(params.projectId as string);
				console.log('loaded project', p);
				if (mounted) setProject(p);
			} catch {
				if (mounted) setProject(null);
			} finally {
				if (mounted) setLoadingProject(false);
			}
		})();
		return () => {
			mounted = false;
		};
	}, [params.projectId]);

	// load image uri
	const [resolvedUri, setResolvedUri] = useState<string | null>(null);
	const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
	React.useEffect(() => {
		let mounted = true;
		(async () => {
			if (!project?.sourceUri) {
				if (mounted) setResolvedUri(null);
				return;
			}
			try {
				const asset = Asset.fromURI(project?.sourceUri);
				await asset.downloadAsync();
				let path = asset.localUri ?? asset.uri;
				if (mounted) setResolvedUri(path);
			} catch (e) {
				let path = project?.sourceUri;
				if (mounted) setResolvedUri(path);
			}
		})();
		return () => { mounted = false; };
	}, [project?.sourceUri]);

	// adjustments
	const [brightness, setBrightness] = useState<number | null>(null);
	const [contrast, setContrast] = useState<number | null>(null);
	const [exposure, setExposure] = useState<number | null>(null);
	const [saturation, setSaturation] = useState<number | null>(null);

	React.useEffect(() => {
		if (project?.adjustments) {
			setBrightness(project.adjustments.brightness ?? 0);
			setContrast(project.adjustments.contrast ?? 0);
			setExposure(project.adjustments.exposure ?? 0);
			setSaturation(project.adjustments.saturation ?? 1);
		} else {
			setBrightness(0);
			setContrast(0);
			setExposure(0);
			setSaturation(1);
		}
	}, [project?.id]);

	// only render sliders when all adjustment states are loaded (prevent glitches)
	const adjustmentsLoaded = brightness !== null && contrast !== null && exposure !== null && saturation !== null;

	const cm = useMemo(() => {
		return colorMatrix(
			brightness ?? 0,
			contrast ?? 0,
			exposure ?? 0,
			saturation ?? 1
		);
	}, [
		brightness,
		contrast,
		exposure,
		saturation
	]);

	// canvas
	const image = useImage(resolvedUri ?? null);
	const canvasRef = useCanvasRef();

	const saveProject = useCallback(async () => {
		if (!project) {
			Alert.alert('Cannot save', 'No project loaded');
			return;
		}

		const skImage = canvasRef.current?.makeImageSnapshot();
		if (!skImage) {
			Alert.alert('Unable to save', 'Image not ready yet.');
			return;
		}

		// save edited image cache
		const base64 = skImage.encodeToBase64(ImageFormat.JPEG, 95);
		const lastEditUri = FileSystem.cacheDirectory + `edit-${Date.now()}.jpg`;
		await FileSystem.writeAsStringAsync(lastEditUri, base64, { encoding: FileSystem.EncodingType.Base64 });

		// save project
		const fileUri = PROJECTS_DIR + `${project?.id}.json`;
		const now = Date.now();
		var saveProject: Project = {
			id: project.id,
			name: project.name,
			sourceUri: project.sourceUri,
			createdAt: project.createdAt,
			editedUri: lastEditUri,
			updatedAt: now,
			adjustments: {
				brightness,
				contrast,
				exposure,
				saturation
			},
		}

		// console.log("projectOnly", project)
		// console.log("saveProject", saveProject)

		await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(saveProject, null, 2));
		Alert.alert('Saved', 'Project saved to recent list.');
	}, [brightness, contrast, exposure, canvasRef]);

	const exportToPhotos = useCallback(async () => {
		const skImage = canvasRef.current?.makeImageSnapshot();
		if (!skImage) {
			Alert.alert('Unable to export', 'Image not ready yet.');
			return;
		}
		const base64 = skImage.encodeToBase64(ImageFormat.JPEG, 95);
		const fileUri = FileSystem.cacheDirectory + `export-${Date.now()}.jpg`;
		await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });

		const { status } = await MediaLibrary.requestPermissionsAsync();
		if (status !== 'granted') {
			Alert.alert('Permission required', 'Please allow Photos permission to export.');
			return;
		}
		await MediaLibrary.saveToLibraryAsync(fileUri);
		Alert.alert('Exported', 'Image saved to your Photos.');
	}, [canvasRef]);

	const readyToDraw = image && canvasSize.width > 0 && canvasSize.height > 0;

	if (loadingProject) {
		return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text>Loading…</Text></View>;
	}

	if (!project) {
		return <Text>Project not found</Text>;
	}

	return (
		<MainContainer>
			{/* <View style={{ padding: 8 }}>
				<Text>Debug: RN Image Preview</Text>
				{resolvedUri ? (
					<RNImage
						source={{ uri: resolvedUri }}
						style={{ width: 200, height: 200, resizeMode: "contain", backgroundColor: "#eee" }}
						onError={(e) => console.log("RN Image load error:", e.nativeEvent.error)}
					/>
				) : (
					<Text style={{color: 'red'}}>Error: No resolved URI available</Text>
				)}
			</View> */}

			{/* Back, Save, Export */}
			<View style={styles.topButtonsRow}>
				<TouchableOpacity onPress={() => router.back()} style={[styles.btn, { backgroundColor: '#666' }]}>
					<Text style={styles.btnText}>Back</Text>
				</TouchableOpacity>
				<TouchableOpacity onPress={saveProject} style={styles.btn}>
					<Text style={styles.btnText}>Save</Text>
				</TouchableOpacity>
				<TouchableOpacity onPress={exportToPhotos} style={[styles.btn, { backgroundColor: '#3cb371' }]}>
					<Text style={styles.btnText}>Export</Text>
				</TouchableOpacity>
			</View>

			{/* Canvas */}
			<View style={{ flex: 1, paddingBottom: "30%" }}>
				<Canvas
					ref={canvasRef}
					style={{ flex: 1 }}
					onLayout={(e) => {
						setCanvasSize({
							width: e.nativeEvent.layout.width,
							height: e.nativeEvent.layout.height,
						});
					}}
				>
					{readyToDraw && (
						<Group layer={<Paint><ColorMatrix matrix={cm} /></Paint>}>
							<SkImage
								image={image}
								x={0}
								y={0}
								width={canvasSize.width}
								height={canvasSize.height}
								fit="contain"
							/>
						</Group>
					)}
				</Canvas>
				{!readyToDraw && (
					<View style={{ position: 'absolute', top: '50%', left: 0, right: 0, alignItems: 'center' }}>
						<Text>Loading image...</Text>
					</View>
				)}
			</View>

			{/* Adjustments */}
			<BottomSheet>
				<Text style={styles.bottomSheetTitle}>Adjustments</Text>
				{
					adjustmentsLoaded ? (
						<>
							<View style={styles.row}>
								<Text style={styles.label}>Brightness</Text>
								<Slider style={styles.slider} minimumValue={-1} maximumValue={1} value={brightness} onValueChange={setBrightness} />
								<Text style={styles.sliderValueLabel}>{brightness.toFixed(2)}</Text>
							</View>
							<View style={styles.row}>
								<Text style={styles.label}>Contrast</Text>
								<Slider style={styles.slider} minimumValue={-1} maximumValue={1} value={contrast} onValueChange={setContrast} />
								<Text style={styles.sliderValueLabel}>{contrast.toFixed(2)}</Text>
							</View>
							<View style={styles.row}>
								<Text style={styles.label}>Exposure</Text>
								<Slider style={styles.slider} minimumValue={-1} maximumValue={1} value={exposure} onValueChange={setExposure} />
								<Text style={styles.sliderValueLabel}>{exposure.toFixed(2)}</Text>
							</View>
							<View style={styles.row}>
								<Text style={styles.label}>Saturation</Text>
								<Slider style={styles.slider} minimumValue={0} maximumValue={2} value={saturation} onValueChange={setSaturation} />
								<Text style={styles.sliderValueLabel}>{saturation.toFixed(2)}</Text>
							</View>
						</>
					):
					(
						<Text>Loading adjustments...</Text>
					)
				}
			</BottomSheet>
		</MainContainer>
	);
}

const styles = StyleSheet.create({
	bottomSheetTitle: {
		fontWeight: '700',
		marginBottom: 4
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 2
	},
	topButtonsRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 2,
		paddingHorizontal:20,
		justifyContent: 'space-between'
	},
	label: {
		width: 60
	},
	sliderValueLabel: {
		textAlign: 'right'
	},
	slider: {
		flex: 1,
		width: 80
	},
	btn: {
		backgroundColor: '#1e90ff',
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderRadius: 8
	},
	btnText: {
		color: 'white',
		fontWeight: '700'
	},
});
