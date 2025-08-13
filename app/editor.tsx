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

function colorMatrix(brightness: number, contrast: number, exposure: number) {
  const b = brightness * 255;
  const c = contrast + 1;
  const e = Math.pow(2, exposure);
  const s = c * e;
  return [
    s, 0, 0, 0, b,
    0, s, 0, 0, b,
    0, 0, s, 0, b,
    0, 0, 0, 1, 0,
  ];
}

export default function Editor() {
  const router = useRouter();
  const params = useLocalSearchParams<{ projectId?: string }>();

  // load project
  const [project, setProject] = useState<Project | null>(null);
  const [loadingProject, setLoadingProject] = useState(true);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!params.projectId) {
          if (alive) setProject(null);
          return;
        }
        const p = await getProject(params.projectId as string);
        if (alive) setProject(p);
      } catch {
        if (alive) setProject(null);
      } finally {
        if (alive) setLoadingProject(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [params.projectId]);

  // load adjustments
  React.useEffect(() => {
    if (project?.adjustments) {
      setBrightness(project.adjustments.brightness ?? 0);
      setContrast(project.adjustments.contrast ?? 0);
      setExposure(project.adjustments.exposure ?? 0);
    } else {
      setBrightness(0);
      setContrast(0);
      setExposure(0);
    }
  }, [project?.id]);

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

  const image = useImage(resolvedUri ?? null);
  const canvasRef = useCanvasRef();

  // image edit states
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [exposure, setExposure] = useState(0);

  const cm = useMemo(() => colorMatrix(brightness, contrast, exposure), [brightness, contrast, exposure]);

  const saveProject = useCallback(async () => {
    const skImage = canvasRef.current?.makeImageSnapshot();
    if (!skImage) {
      Alert.alert('Unable to save', 'Image not ready yet.');
      return;
    }

    // save edited image cache
    const base64 = skImage.encodeToBase64(ImageFormat.JPEG, 95);
    const editedUri = FileSystem.cacheDirectory + `edit-${Date.now()}.jpg`;
    await FileSystem.writeAsStringAsync(editedUri, base64, { encoding: FileSystem.EncodingType.Base64 });

    // save project
    const fileUri = PROJECTS_DIR + `${project?.id}.json`;
    const now = Date.now();
    console.log(brightness, contrast, exposure);
    var saveProject: Project = {
      ...project as Project,
      editedUri: editedUri,
      updatedAt: now,
      adjustments: { brightness, contrast, exposure },
    }

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
    <View style={{ flex: 1, paddingTop: 40 }}>
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, gap: 8 }}>
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
            <Group layer>
              <Paint>
                <ColorMatrix matrix={cm} />
              </Paint>
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

      <BottomSheet>
        <Text style={styles.panelTitle}>Adjustments</Text>
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
          <Slider style={styles.slider} minimumValue={-2} maximumValue={2} value={exposure} onValueChange={setExposure} />
          <Text style={styles.sliderValueLabel}>{exposure.toFixed(2)}</Text>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#ddd' },
  panelTitle: { fontWeight: '700', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { width: 80 },
  sliderValueLabel: { width: 50, textAlign: 'center' },
  slider: { flex: 1 },
  btn: { backgroundColor: '#1e90ff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  btnText: { color: 'white', fontWeight: '700' },
});
