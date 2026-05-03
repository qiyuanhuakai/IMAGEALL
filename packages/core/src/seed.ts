import type { Artifact, LocaleOption, Run, WorkbenchBootstrap, Workspace } from './domain'
import { providerManifests } from './providers'

const locales: LocaleOption[] = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
]

function createDemoImage(title: string, subtitle: string, from: string, to: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="960" viewBox="0 0 1280 960">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${from}" />
          <stop offset="100%" stop-color="${to}" />
        </linearGradient>
      </defs>
      <rect fill="#07111f" width="1280" height="960" rx="40" />
      <rect fill="url(#g)" x="48" y="48" width="1184" height="864" rx="32" opacity="0.9" />
      <circle cx="218" cy="188" r="120" fill="rgba(255,255,255,0.14)" />
      <circle cx="1010" cy="738" r="180" fill="rgba(255,255,255,0.12)" />
      <rect x="88" y="96" width="1104" height="768" rx="26" fill="rgba(8,12,24,0.28)" stroke="rgba(255,255,255,0.28)" />
      <text x="120" y="196" fill="#f8fbff" font-family="Inter, Arial, sans-serif" font-size="72" font-weight="700">${title}</text>
      <text x="120" y="266" fill="rgba(248,251,255,0.84)" font-family="Inter, Arial, sans-serif" font-size="28">${subtitle}</text>
      <text x="120" y="808" fill="rgba(248,251,255,0.72)" font-family="JetBrains Mono, monospace" font-size="24">ImageAll demo artifact</text>
    </svg>
  `

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const artifacts: Artifact[] = [
  {
    id: 'artifact-source-01',
    workspaceId: 'workspace-demo',
    kind: 'input',
    title: 'Source portrait',
    mimeType: 'image/svg+xml',
    width: 1280,
    height: 960,
    uri: createDemoImage('Source Portrait', 'Imported reference image for edit and upscale flows', '#264e8f', '#05101f'),
    createdAt: '2026-05-02T15:00:00.000Z',
    metadata: {},
  },
  {
    id: 'artifact-minimax-01',
    workspaceId: 'workspace-demo',
    kind: 'generated',
    title: 'MiniMax — cinematic city study',
    mimeType: 'image/svg+xml',
    width: 1280,
    height: 960,
    uri: createDemoImage('MiniMax / Generate', 'Cinematic city study with restrained neon and architectural rhythm', '#1b3f84', '#6d8dff'),
    createdAt: '2026-05-02T15:04:00.000Z',
    sourceRunId: 'run-minimax-01',
    metadata: {
      provider: 'minimax',
      model: 'image-01-live',
      seed: 94102,
      prompt: 'An evening city study with cinematic framing and quiet blue neon accents.',
    },
  },
  {
    id: 'artifact-stepfun-01',
    workspaceId: 'workspace-demo',
    kind: 'edited',
    title: 'StepFun — typography edit',
    mimeType: 'image/svg+xml',
    width: 1280,
    height: 960,
    uri: createDemoImage('StepFun / Edit', 'Standard StepFun edit flow with documented image endpoints', '#3a237b', '#7f8cff'),
    createdAt: '2026-05-02T15:09:00.000Z',
    sourceRunId: 'run-stepfun-01',
    parentArtifactId: 'artifact-source-01',
    metadata: {
      provider: 'stepfun',
      model: 'step-image-edit-2',
      seed: 1207,
      prompt: 'Convert the portrait into a bold editorial poster with controlled text contrast.',
    },
  },
  {
    id: 'artifact-stepfun-plan-01',
    workspaceId: 'workspace-demo',
    kind: 'edited',
    title: 'StepFun Plan — typography edit',
    mimeType: 'image/svg+xml',
    width: 1280,
    height: 960,
    uri: createDemoImage('StepFun Plan / Edit', 'Typography-focused edit with sharper layout contrast and poster language', '#2b1c63', '#bb87ff'),
    createdAt: '2026-05-02T15:11:00.000Z',
    sourceRunId: 'run-stepfun-plan-01',
    parentArtifactId: 'artifact-source-01',
    metadata: {
      provider: 'stepfun-plan',
      model: 'step-image-edit-2',
      seed: 1017,
      prompt: 'Transform the portrait into a text-led poster with modern magazine contrast.',
    },
  },
  {
    id: 'artifact-minimax-02',
    workspaceId: 'workspace-demo',
    kind: 'generated',
    title: 'MiniMax — watercolor variation',
    mimeType: 'image/svg+xml',
    width: 1280,
    height: 960,
    uri: createDemoImage('MiniMax / Live Style', 'A softer watercolor variation for side-by-side comparison', '#0a3456', '#66b6ff'),
    createdAt: '2026-05-02T15:16:00.000Z',
    sourceRunId: 'run-minimax-02',
    metadata: {
      provider: 'minimax',
      model: 'image-01-live',
      seed: 94102,
      prompt: 'A calmer watercolor interpretation of the same city study.',
    },
  },
]

const runs: Run[] = [
  {
    id: 'run-minimax-01',
    workspaceId: 'workspace-demo',
    providerId: 'minimax',
    modelId: 'image-01-live',
    operation: {
      kind: 'generate',
      prompt: 'An evening city study with cinematic framing and quiet blue neon accents.',
      aspectRatio: '4:3',
      seed: 94102,
      numImages: 2,
      responseFormat: 'url',
    },
    providerSnapshot: {
      adaptorVersion: '0.1.0',
      resolvedParams: {
        promptOptimizer: true,
        style: 'watercolor',
        styleWeight: 0.7,
      },
    },
    status: 'succeeded',
    createdAt: '2026-05-02T15:03:30.000Z',
    startedAt: '2026-05-02T15:03:32.000Z',
    finishedAt: '2026-05-02T15:04:00.000Z',
    outputArtifactIds: ['artifact-minimax-01'],
    logs: [
      { timestamp: '2026-05-02T15:03:32.000Z', level: 'info', message: 'Prompt normalized for image-01-live.' },
      { timestamp: '2026-05-02T15:03:47.000Z', level: 'info', message: 'Received output URLs for 1 image.' },
    ],
  },
  {
    id: 'run-stepfun-01',
    workspaceId: 'workspace-demo',
    providerId: 'stepfun',
    modelId: 'step-image-edit-2',
    operation: {
      kind: 'edit',
      prompt: 'Convert the portrait into a bold editorial poster with controlled text contrast.',
      negativePrompt: 'muddy text, weak composition',
      sourceArtifactId: 'artifact-source-01',
      seed: 1207,
      responseFormat: 'base64',
    },
    providerSnapshot: {
      adaptorVersion: '0.1.0',
      resolvedParams: {
        textMode: true,
        responseFormat: 'base64',
      },
    },
    status: 'succeeded',
    createdAt: '2026-05-02T15:08:05.000Z',
    startedAt: '2026-05-02T15:08:08.000Z',
    finishedAt: '2026-05-02T15:09:00.000Z',
    outputArtifactIds: ['artifact-stepfun-01'],
    logs: [
      { timestamp: '2026-05-02T15:08:08.000Z', level: 'info', message: 'Prepared standard StepFun edit request.' },
      { timestamp: '2026-05-02T15:08:42.000Z', level: 'info', message: 'Run completed with finish_reason=success.' },
    ],
  },
  {
    id: 'run-stepfun-plan-01',
    workspaceId: 'workspace-demo',
    providerId: 'stepfun-plan',
    modelId: 'step-image-edit-2',
    operation: {
      kind: 'edit',
      prompt: 'Transform the portrait into a text-led poster with modern magazine contrast.',
      negativePrompt: 'muddy text, flat composition',
      sourceArtifactId: 'artifact-source-01',
      seed: 1017,
      responseFormat: 'base64',
    },
    providerSnapshot: {
      adaptorVersion: '0.1.0',
      resolvedParams: {
        textMode: true,
        responseFormat: 'base64',
      },
    },
    status: 'succeeded',
    createdAt: '2026-05-02T15:10:05.000Z',
    startedAt: '2026-05-02T15:10:08.000Z',
    finishedAt: '2026-05-02T15:11:00.000Z',
    outputArtifactIds: ['artifact-stepfun-plan-01'],
    logs: [
      { timestamp: '2026-05-02T15:10:08.000Z', level: 'info', message: 'Prepared stepfun-plan edit request against the step_plan namespace.' },
      { timestamp: '2026-05-02T15:10:42.000Z', level: 'info', message: 'Run completed with finish_reason=success.' },
    ],
  },
  {
    id: 'run-minimax-02',
    workspaceId: 'workspace-demo',
    providerId: 'minimax',
    modelId: 'image-01-live',
    operation: {
      kind: 'generate',
      prompt: 'A calmer watercolor interpretation of the same city study.',
      aspectRatio: '4:3',
      seed: 94102,
      numImages: 1,
      responseFormat: 'url',
    },
    providerSnapshot: {
      adaptorVersion: '0.1.0',
      resolvedParams: {
        promptOptimizer: true,
        style: 'watercolor',
        styleWeight: 0.85,
      },
    },
    status: 'succeeded',
    createdAt: '2026-05-02T15:15:40.000Z',
    startedAt: '2026-05-02T15:15:42.000Z',
    finishedAt: '2026-05-02T15:16:00.000Z',
    outputArtifactIds: ['artifact-minimax-02'],
    logs: [
      { timestamp: '2026-05-02T15:15:42.000Z', level: 'info', message: 'Reused the earlier seed for a calmer comparison pass.' },
    ],
  },
  {
    id: 'run-stepfun-02',
    workspaceId: 'workspace-demo',
    providerId: 'stepfun',
    modelId: 'step-1x-medium',
    operation: {
      kind: 'generate',
      prompt: 'Poster exploration with a strong editorial rhythm and centered title lockup.',
      size: { width: 1024, height: 1024 },
      responseFormat: 'url',
    },
    providerSnapshot: {
        adaptorVersion: '0.1.0',
      resolvedParams: {
        styleReferenceWeight: 1.2,
      },
    },
    status: 'failed',
    createdAt: '2026-05-02T15:21:00.000Z',
    startedAt: '2026-05-02T15:21:01.000Z',
    finishedAt: '2026-05-02T15:21:04.000Z',
    outputArtifactIds: [],
    logs: [
      { timestamp: '2026-05-02T15:21:01.000Z', level: 'info', message: 'Queued style-conditioned generation.' },
      { timestamp: '2026-05-02T15:21:04.000Z', level: 'error', message: 'Provider rejected style reference payload.' },
    ],
    error: {
      code: 'STYLE_REFERENCE_INVALID',
      message: 'StepFun refused the style reference payload during validation.',
    },
  },
]

const workspace: Workspace = {
  id: 'workspace-demo',
  name: 'Founding studies',
  locale: 'zh-CN',
  createdAt: '2026-05-02T14:58:00.000Z',
  updatedAt: '2026-05-02T15:21:04.000Z',
  artifactIds: artifacts.map((artifact) => artifact.id),
  runIds: runs.map((run) => run.id),
  uiState: {
    selectedArtifactId: 'artifact-stepfun-plan-01',
    compareArtifactIds: ['artifact-minimax-01', 'artifact-minimax-02'],
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
