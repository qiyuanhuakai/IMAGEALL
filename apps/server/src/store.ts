import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  rename,
  access,
} from 'node:fs/promises'
import { join } from 'node:path'
import type {
  Artifact,
  Run,
  WorkspaceMetadata,
  WorkspaceStatus,
  RestoredWorkspace,
  Workspace,
} from '@imageall/core'

interface StoredRun extends Run {
  outputArtifactIds: string[]
}

interface PersistedArtifact {
  id: string
  workspaceId: string
  kind: Artifact['kind']
  title: string
  mimeType: string
  width: number
  height: number
  thumbnailUri: string | undefined
  createdAt: string
  sourceRunId: string | undefined
  parentArtifactId: string | undefined
  metadata: Artifact['metadata']
  imageFile: string
  imageExists: boolean
}

const runStore = new Map<string, StoredRun>()
const artifactStore = new Map<string, Artifact>()
let workspaceFolder: string | null = null

async function atomicWriteJson(filepath: string, data: unknown): Promise<void> {
  const tmpPath = filepath + '.tmp'
  await writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  await rename(tmpPath, filepath)
}

async function readJsonSafe<T>(filepath: string): Promise<T | null> {
  try {
    const content = await readFile(filepath, 'utf-8')
    return JSON.parse(content) as T
  } catch {
    return null
  }
}

async function ensureImageAllDirs(workspacePath: string): Promise<void> {
  const imageAllDir = join(workspacePath, '.imageall')
  const artifactsDir = join(imageAllDir, 'artifacts')
  const runsDir = join(imageAllDir, 'runs')
  await mkdir(artifactsDir, { recursive: true })
  await mkdir(runsDir, { recursive: true })
}

async function fileExists(filepath: string): Promise<boolean> {
  try {
    await access(filepath)
    return true
  } catch {
    return false
  }
}

export async function setWorkspaceFolder(path: string): Promise<void> {
  workspaceFolder = path
  runStore.clear()
  artifactStore.clear()
}

export function getWorkspaceFolder(): string | null {
  return workspaceFolder
}

export function storeRun(run: StoredRun): void {
  runStore.set(run.id, run)

  if (workspaceFolder) {
    persistRun(workspaceFolder, run).catch(() => {})
  }
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

  if (workspaceFolder) {
    let imageBuffer: Buffer | undefined
    if (artifact.uri.startsWith('data:')) {
      const base64 = artifact.uri.split(',')[1] ?? ''
      imageBuffer = Buffer.from(base64, 'base64')
    } else if (/^https?:\/\//.test(artifact.uri)) {
      try {
        const response = await fetch(artifact.uri)
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer()
          imageBuffer = Buffer.from(arrayBuffer)
        }
      } catch {}
    }

    try {
      await persistArtifact(workspaceFolder, artifact, imageBuffer)
    } catch {}
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

export async function saveWorkspaceMetadata(
  workspacePath: string,
  metadata: WorkspaceMetadata,
): Promise<void> {
  await ensureImageAllDirs(workspacePath)
  const filepath = join(workspacePath, '.imageall', 'workspace.json')
  await atomicWriteJson(filepath, metadata)
}

export async function loadWorkspaceMetadata(
  workspacePath: string,
): Promise<WorkspaceMetadata | null> {
  const filepath = join(workspacePath, '.imageall', 'workspace.json')
  return readJsonSafe<WorkspaceMetadata>(filepath)
}

function artifactToPersisted(
  artifact: Artifact,
  imageFile: string,
  imageExists: boolean,
): PersistedArtifact {
  return {
    id: artifact.id,
    workspaceId: artifact.workspaceId,
    kind: artifact.kind,
    title: artifact.title,
    mimeType: artifact.mimeType,
    width: artifact.width,
    height: artifact.height,
    thumbnailUri: artifact.thumbnailUri,
    createdAt: artifact.createdAt,
    sourceRunId: artifact.sourceRunId,
    parentArtifactId: artifact.parentArtifactId,
    metadata: artifact.metadata,
    imageFile,
    imageExists,
  }
}

function persistedToArtifact(pa: PersistedArtifact, imageExists: boolean): Artifact {
  const artifact: Artifact = {
    id: pa.id,
    workspaceId: pa.workspaceId,
    kind: pa.kind,
    title: pa.title,
    mimeType: pa.mimeType,
    width: pa.width,
    height: pa.height,
    uri: imageExists ? `__serve__:${pa.imageFile}` : '',
    createdAt: pa.createdAt,
    metadata: pa.metadata,
  }
  if (pa.thumbnailUri !== undefined) artifact.thumbnailUri = pa.thumbnailUri
  if (pa.sourceRunId !== undefined) artifact.sourceRunId = pa.sourceRunId
  if (pa.parentArtifactId !== undefined) artifact.parentArtifactId = pa.parentArtifactId
  return artifact
}

export async function persistArtifact(
  workspacePath: string,
  artifact: Artifact,
  imageBuffer?: Buffer,
): Promise<void> {
  const artifactsDir = join(workspacePath, '.imageall', 'artifacts')
  await mkdir(artifactsDir, { recursive: true })

  const ext = artifact.mimeType.includes('png') ? 'png' : 'jpg'
  const imageFilename = `${artifact.id}.${ext}`
  const imageFile = join('.imageall', 'artifacts', imageFilename)
  const imageFilepath = join(workspacePath, imageFile)

  if (imageBuffer) {
    await writeFile(imageFilepath, imageBuffer)

    try {
      const legacyDir = join(workspacePath, 'imageall')
      await mkdir(legacyDir, { recursive: true })
      await writeFile(join(legacyDir, imageFilename), imageBuffer)
    } catch {}
  }

  const imageExists = await fileExists(imageFilepath)
  const persisted = artifactToPersisted(artifact, imageFile, imageExists)
  const jsonPath = join(artifactsDir, `${artifact.id}.json`)
  await atomicWriteJson(jsonPath, persisted)
}

export async function loadArtifactMetadata(
  workspacePath: string,
  artifactId: string,
): Promise<Artifact | null> {
  const jsonPath = join(workspacePath, '.imageall', 'artifacts', `${artifactId}.json`)
  const persisted = await readJsonSafe<PersistedArtifact>(jsonPath)
  if (!persisted) return null

  const imageFilepath = join(workspacePath, persisted.imageFile)
  const imageExists = await fileExists(imageFilepath)
  return persistedToArtifact(persisted, imageExists)
}

export async function loadAllArtifacts(workspacePath: string): Promise<Artifact[]> {
  const artifactsDir = join(workspacePath, '.imageall', 'artifacts')

  let entries: string[]
  try {
    entries = await readdir(artifactsDir)
  } catch {
    return []
  }

  const jsonFiles = entries.filter((f) => f.endsWith('.json'))
  const artifacts: Artifact[] = []

  for (const file of jsonFiles) {
    const jsonPath = join(artifactsDir, file)
    const persisted = await readJsonSafe<PersistedArtifact>(jsonPath)
    if (!persisted) continue

    const imageFilepath = join(workspacePath, persisted.imageFile)
    const imageExists = await fileExists(imageFilepath)
    artifacts.push(persistedToArtifact(persisted, imageExists))
  }

  return artifacts.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export async function persistRun(workspacePath: string, run: StoredRun): Promise<void> {
  const runsDir = join(workspacePath, '.imageall', 'runs')
  await mkdir(runsDir, { recursive: true })
  const filepath = join(runsDir, `${run.id}.json`)
  await atomicWriteJson(filepath, run)
}

export async function loadRunMetadata(
  workspacePath: string,
  runId: string,
): Promise<StoredRun | null> {
  const filepath = join(workspacePath, '.imageall', 'runs', `${runId}.json`)
  return readJsonSafe<StoredRun>(filepath)
}

export async function loadAllRuns(workspacePath: string): Promise<StoredRun[]> {
  const runsDir = join(workspacePath, '.imageall', 'runs')

  let entries: string[]
  try {
    entries = await readdir(runsDir)
  } catch {
    return []
  }

  const jsonFiles = entries.filter((f) => f.endsWith('.json'))
  const runs: StoredRun[] = []

  for (const file of jsonFiles) {
    const filepath = join(runsDir, file)
    const run = await readJsonSafe<StoredRun>(filepath)
    if (run) runs.push(run)
  }

  return runs.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export async function getWorkspaceStatus(
  workspacePath: string,
): Promise<WorkspaceStatus> {
  const imageAllDir = join(workspacePath, '.imageall')
  const exists = await fileExists(imageAllDir)

  if (!exists) {
    return {
      exists: false,
      artifactCount: 0,
      runCount: 0,
    }
  }

  let artifactCount = 0
  let runCount = 0
  let lastModified: string | undefined

  try {
    const artifactFiles = await readdir(join(imageAllDir, 'artifacts'))
    artifactCount = artifactFiles.filter((f) => f.endsWith('.json')).length
  } catch {}

  try {
    const runFiles = await readdir(join(imageAllDir, 'runs'))
    runCount = runFiles.filter((f) => f.endsWith('.json')).length
  } catch {}

  try {
    const wsMeta = await loadWorkspaceMetadata(workspacePath)
    if (wsMeta) {
      lastModified = wsMeta.updatedAt
    }
  } catch {}

  const result: WorkspaceStatus = {
    exists: true,
    artifactCount,
    runCount,
  }
  if (lastModified !== undefined) result.lastModified = lastModified
  return result
}

export async function restoreWorkspace(
  workspacePath: string,
): Promise<RestoredWorkspace> {
  const warnings: string[] = []
  const restoredAt = new Date().toISOString()

  const metadata = await loadWorkspaceMetadata(workspacePath)

  const baseWorkspace: { id: string; name: string; locale: 'en' | 'zh-CN'; createdAt: string; updatedAt: string } = metadata
    ? {
        id: metadata.id,
        name: metadata.name,
        locale: metadata.locale,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
      }
    : {
        id: 'restored',
        name: 'Restored Workspace',
        locale: 'en' as const,
        createdAt: restoredAt,
        updatedAt: restoredAt,
      }

  const uiState = metadata
    ? {
        compareArtifactIds: metadata.compareArtifactIds,
        activeOperation: metadata.activeOperation,
        activeProviderId: metadata.activeProviderId,
        activeModelId: metadata.activeModelId,
      }
    : {
        compareArtifactIds: [],
        activeOperation: 'generate' as const,
        activeProviderId: '',
        activeModelId: '',
      }

  const workspace: Workspace = {
    ...baseWorkspace,
    artifactIds: [],
    runIds: [],
    uiState: metadata?.selectedArtifactId !== undefined
      ? { ...uiState, selectedArtifactId: metadata.selectedArtifactId }
      : uiState,
  }

  const artifacts = await loadAllArtifacts(workspacePath)

  const missingImages = artifacts.filter((a) => !a.uri)
  if (missingImages.length > 0) {
    warnings.push(`${missingImages.length} artifact(s) have missing images`)
  }

  const runs = await loadAllRuns(workspacePath)

  workspace.artifactIds = artifacts.map((a) => a.id)
  workspace.runIds = runs.map((r) => r.id)
  for (const artifact of artifacts) {
    artifactStore.set(artifact.id, artifact)
  }
  for (const run of runs) {
    runStore.set(run.id, run)
  }

  return {
    workspace,
    artifacts,
    runs,
    restoredAt,
    warnings,
  }
}
