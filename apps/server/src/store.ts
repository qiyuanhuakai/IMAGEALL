import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Artifact, Run } from '@imageall/core'

interface StoredRun extends Run {
  outputArtifactIds: string[]
}

const runStore = new Map<string, StoredRun>()
const artifactStore = new Map<string, Artifact>()
let workspaceFolder: string | null = null

export function setWorkspaceFolder(path: string): void {
  workspaceFolder = path
}

export function getWorkspaceFolder(): string | null {
  return workspaceFolder
}

export function storeRun(run: StoredRun): void {
  runStore.set(run.id, run)
}

export function getRun(runId: string): StoredRun | undefined {
  return runStore.get(runId)
}

export function listRuns(): StoredRun[] {
  return [...runStore.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export async function storeArtifact(artifact: Artifact): Promise<void> {
  artifactStore.set(artifact.id, artifact)

  if (workspaceFolder && artifact.uri.startsWith('data:')) {
    try {
      const base64 = artifact.uri.split(',')[1] ?? ''
      const ext = artifact.mimeType.includes('png') ? 'png' : 'jpg'
      const filename = `${artifact.id}.${ext}`
      const dir = join(workspaceFolder, 'imageall')
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, filename), Buffer.from(base64, 'base64'))
    } catch {
      /* ignore write errors */
    }
  }
}

export function getArtifact(artifactId: string): Artifact | undefined {
  return artifactStore.get(artifactId)
}

export function listArtifacts(): Artifact[] {
  return [...artifactStore.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}
