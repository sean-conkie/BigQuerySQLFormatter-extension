import { ProjectsClient } from '@google-cloud/resource-manager';

export async function listProjects(): Promise<string[]> {
  // Create a client using ADC
  const client = new ProjectsClient();

  // List all projects the authenticated user has access to
  const [projects] = await client.searchProjects();

  if (!projects || projects.length === 0) {
    console.log('No projects found.');
    return;
  }
	
	return projects.map(project => `${project.projectId}`).sort((a, b) => a.localeCompare(b));

}
