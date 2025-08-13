import MainContainer from '@/components/MainContainer';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Project, deleteProject, initiateNewProject, loadProjects } from '../repositories/project_repo';

export default function Home() {
	const router = useRouter();
	const [projects, setProjects] = useState<Project[]>([]);
	const [loading, setLoading] = useState(false);

	const refresh = useCallback(async () => {
		setLoading(true);
		const data = await loadProjects();
		setProjects(data);
		setLoading(false);
	}, []);

	useFocusEffect(
		useCallback(() => {
			refresh();
		}, [refresh])
	);

	const pickFromGallery = useCallback(async () => {
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (status !== 'granted') {
			Alert.alert('Permission required', 'Media library permission is needed to pick images.');
			return;
		}
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			quality: 1,
		});
		if (result.canceled) return;
		const uri = result.assets?.[0]?.uri;
		if (!uri) return;

		// initiate project
		const newProject = await initiateNewProject(uri);
		setProjects([...projects, newProject]);

		// redirect to editor
		router.push({ pathname: '/editor', params: { projectId: newProject.id } });
	}, [router]);

	const openCamera = useCallback(() => {
		router.push('/camera');
	}, [router]);

	const openProject = useCallback(
		(item: Project) => {
			router.push({ pathname: '/editor', params: { projectId: item.id } });
		},
		[router]
	);

	const handleDelete = async (projectId: string) => {
		try {
			await deleteProject(projectId);
			setProjects(prev => prev.filter(p => p.id !== projectId));
		} catch (error) {
			Alert.alert('Delete Failed', 'Could not delete project');
		}
	};

	const renderItem = ({ item }: { item: Project }) => (
		<TouchableOpacity style={styles.card} onPress={() => openProject(item)}>
			<Image source={{ uri: item.editedUri ?? item.sourceUri }} style={styles.thumb} />
			<View style={{ flex: 1 }}>
				<Text style={styles.cardTitle}>{item.name}</Text>
				<Text style={styles.cardMeta}>
					Updated {new Date(item.updatedAt).toLocaleString()}
				</Text>
			</View>
			<TouchableOpacity
				style={styles.deleteBtn}
				onPress={(e) => {
					e.stopPropagation();
					handleDelete(item.id);
				}}
			>
				<Text style={styles.deleteText}>×</Text>
			</TouchableOpacity>
		</TouchableOpacity>
	);

	return (
		<MainContainer>
			<Text style={styles.title}>Recent Projects</Text>
			<View style={styles.actions}>
				<TouchableOpacity style={styles.actionBtn} onPress={pickFromGallery}>
					<Text style={styles.actionText}>Pick from Gallery</Text>
				</TouchableOpacity>
				<TouchableOpacity style={styles.actionBtn} onPress={openCamera}>
					<Text style={styles.actionText}>Open Camera</Text>
				</TouchableOpacity>
				{/* <TouchableOpacity style={[styles.actionBtn, styles.danger]} onPress={clearAll}>
					<Text style={styles.actionText}>Clear</Text>
				</TouchableOpacity> */}
			</View>
			<FlatList
				data={projects}
				refreshing={loading}
				onRefresh={refresh}
				keyExtractor={(item) => item.id}
				renderItem={renderItem}
				contentContainerStyle={{ paddingBottom: 24 }}
				ListEmptyComponent={
					<View style={styles.empty}>
						<Text style={styles.emptyText}>No recent projects yet.</Text>
						<Text style={styles.emptyText}>Pick an image or open camera to start.</Text>
					</View>
				}
			/>
		</MainContainer>
	);
}

const styles = StyleSheet.create({
	title: { fontSize: 24, fontWeight: '600', marginBottom: 12 },
	actions: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
	actionBtn: { backgroundColor: '#1e90ff', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
	actionText: { color: 'white', fontWeight: '600' },
	danger: { backgroundColor: '#d9534f' },
	deleteBtn: {
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 15,
		backgroundColor: '#ff4444',
	},
	deleteText: {
		color: 'white',
		fontSize: 20,
		fontWeight: 'bold',
		lineHeight: 20,
	},
	card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ddd' },
	thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#eee' },
	cardTitle: { fontSize: 16, fontWeight: '600' },
	cardMeta: { color: '#666', marginTop: 4 },
	empty: { alignItems: 'center', marginTop: 48 },
	emptyText: { color: '#666', marginTop: 4 },
});
