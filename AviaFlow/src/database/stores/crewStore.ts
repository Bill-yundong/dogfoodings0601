import { getDB } from '../schema';
import type { CrewMember, CrewStatus, CrewRole } from '../../types/crew';

export async function addCrewMember(crew: CrewMember): Promise<string> {
  const db = await getDB();
  return db.add('crewMembers', crew);
}

export async function updateCrewMember(crew: CrewMember): Promise<string> {
  const db = await getDB();
  return db.put('crewMembers', crew);
}

export async function getCrewMember(id: string): Promise<CrewMember | undefined> {
  const db = await getDB();
  return db.get('crewMembers', id);
}

export async function getAllCrewMembers(): Promise<CrewMember[]> {
  const db = await getDB();
  return db.getAll('crewMembers');
}

export async function getCrewByRole(role: CrewRole): Promise<CrewMember[]> {
  const db = await getDB();
  return db.getAllFromIndex('crewMembers', 'by-role', role);
}

export async function getCrewByStatus(status: CrewStatus): Promise<CrewMember[]> {
  const db = await getDB();
  return db.getAllFromIndex('crewMembers', 'by-status', status);
}

export async function searchCrewByName(name: string): Promise<CrewMember[]> {
  const db = await getDB();
  const all = await db.getAll('crewMembers');
  return all.filter(c => c.name.includes(name));
}

export async function deleteCrewMember(id: string): Promise<void> {
  const db = await getDB();
  return db.delete('crewMembers', id);
}

export async function bulkAddCrewMembers(crewList: CrewMember[]): Promise<string[]> {
  const db = await getDB();
  const tx = db.transaction('crewMembers', 'readwrite');
  const promises = crewList.map(crew => tx.store.add(crew));
  const results = await Promise.all(promises);
  await tx.done;
  return results;
}
