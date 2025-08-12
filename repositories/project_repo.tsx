import * as FileSystem from 'expo-file-system';

export const PROJECTS_DIR = FileSystem.documentDirectory + "projects/";

export type Project = {
  id: string;
  name?: string;
  sourceUri: string; // original image
  editedUri?: string; // latest saved edit
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
  adjustments?: {
    brightness?: number;
    contrast?: number;
    exposure?: number;
  };
};

export async function initiateNewProject(uri: string): Promise<Project> {
    const now = Date.now().toString();
    const id = now;
    const fileUri = PROJECTS_DIR + `${id}.json`;
    const newProject: Project = {
      id,
      name: `Project ${now}`,
      sourceUri: uri,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(newProject, null, 2));

    return newProject;
}

export async function loadProjects(): Promise<Project[]> {
  // ensure directory
  const dirInfo = await FileSystem.getInfoAsync(PROJECTS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(PROJECTS_DIR, { intermediates: true });
    return [];
  }

  // get all files
  const files = await FileSystem.readDirectoryAsync(PROJECTS_DIR);

  // filter only .json files
  const jsonFiles = files.filter(file => file.endsWith(".json"));

  // read files
  const projects: Project[] = [];
  for (const file of jsonFiles) {
    const fileUri = PROJECTS_DIR + file;
    try {
      const content = await FileSystem.readAsStringAsync(fileUri);
      projects.push(JSON.parse(content) as Project);
    } catch (err) {
      console.warn(`Failed to read project file: ${file}`, err);
    }
  }

  return projects;
}

export async function getProject(projectId: string): Promise<Project | null> {
  const fileUri = PROJECTS_DIR + `${projectId}.json`;

  const fileInfo = await FileSystem.getInfoAsync(fileUri);

  if (!fileInfo.exists) {
    return null; // project not found
  }

  const content = await FileSystem.readAsStringAsync(fileUri);
  return JSON.parse(content) as Project;
}