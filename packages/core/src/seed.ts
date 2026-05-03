import type { Artifact, LocaleOption, Run, WorkbenchBootstrap, Workspace } from './domain'
import { providerManifests } from './providers'

const locales: LocaleOption[] = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
]

const artifacts: Artifact[] = []
const runs: Run[] = []

const workspace: Workspace = {
  id: 'workspace-demo',
  name: 'Founding studies',
  locale: 'zh-CN',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  artifactIds: [],
  runIds: [],
  uiState: {
    compareArtifactIds: [],
    activeOperation: 'generate',
    activeProviderId: 'minimax',
    activeModelId: 'image-01-live',
  },
}

export function createDemoBootstrap(): WorkbenchBootstrap {
  return {
    generatedAt: new Date().toISOString(),
    locales,
    providers: providerManifests,
    workspaces: [workspace],
    artifacts,
    runs,
    selectedWorkspaceId: workspace.id,
  }
}
