import * as crypto from 'node:crypto';

export type MediaType = 'video' | 'audio' | 'image' | 'social' | 'text' | 'podcast';

export interface GenerationParams {
  prompt: string;
  style?: string;
  duration?: string;
  format?: string;
  platform?: string;
  language?: string;
  tone?: string;
  targetAudience?: string;
}

export interface GeneratedScript {
  id: string;
  mediaType: MediaType;
  content: string;
  structure?: ScriptStructure;
  metadata: GenerationMetadata;
  createdAt: string;
}

export interface ScriptStructure {
  title: string;
  sections: ScriptSection[];
}

export interface ScriptSection {
  name: string;
  timestamp?: string;
  content: string;
  type: 'hook' | 'intro' | 'body' | 'cta' | 'outro' | 'visual' | 'audio' | 'transition';
}

export interface GenerationMetadata {
  platform?: string;
  duration?: string;
  format?: string;
  style?: string;
  tags: string[];
}

export interface AudioProductionGuide {
  bpm?: number;
  key?: string;
  instrumentation: string[];
  structure: AudioSection[];
  mixing: MixingGuide;
  references: string[];
}

export interface AudioSection {
  name: string;
  timestamp: string;
  description: string;
  elements: string[];
}

export interface MixingGuide {
  eq: EQSettings[];
  compression: CompressionSettings[];
  reverb: ReverbSettings[];
  masterChain: string[];
}

export interface EQSettings {
  element: string;
  cuts: string[];
  boosts: string[];
}

export interface CompressionSettings {
  element: string;
  ratio: string;
  attack: string;
  release: string;
  threshold: string;
}

export interface ReverbSettings {
  element: string;
  type: string;
  decay: string;
  mix: string;
}

export interface VideoProductionPlan {
  preProduction: PreProductionPlan;
  shootingPlan: ShootingPlan;
  postProduction: PostProductionPlan;
  deliverySpecs: DeliverySpec[];
}

export interface PreProductionPlan {
  script: GeneratedScript | null;
  storyboard: StoryboardFrame[];
  equipment: string[];
  location: string;
  cast: string[];
  schedule: string;
}

export interface StoryboardFrame {
  frame: number;
  timestamp: string;
  shot: string;
  composition: string;
  action: string;
  notes: string;
}

export interface ShootingPlan {
  camera: CameraSettings;
  lighting: LightingPlan;
  audio: AudioCapturePlan;
}

export interface CameraSettings {
  resolution: string;
  frameRate: string;
  shutterSpeed: string;
  settings: {
    [key: string]: string;
  };
  lens: string[];
}

export interface LightingPlan {
  keyLight: string;
  fillLight: string;
  rimLight: string;
  ambient: string;
  setup: string[];
}

export interface AudioCapturePlan {
  micType: string;
  placement: string;
  monitoring: string;
  backup: string;
}

export interface PostProductionPlan {
  workflow: PostWorkflow[];
  colorGrading: ColorGradingPlan;
  audioPost: string[];
  graphics: string[];
}

export interface PostWorkflow {
  step: number;
  name: string;
  description: string;
  software: string[];
  timeEstimate: string;
}

export interface ColorGradingPlan {
  primary: string;
  secondary: string;
  lookAndFeel: string;
  references: string[];
}

export interface DeliverySpec {
  platform: string;
  resolution: string;
  aspectRatio: string;
  codec: string;
  audio: string;
}

export interface ImagePromptPack {
  platform: string;
  model: 'stable_diffusion' | 'midjourney' | 'dall-e' | 'flux';
  prompts: ImagePrompt[];
  negativePrompts: string[];
  globalSettings: ImageGenerationSettings;
}

export interface ImagePrompt {
  id: string;
  subject: string;
  style: string;
  composition: string;
  lighting: string;
  camera: string;
  fullPrompt: string;
  parameters: { key: string; value: string }[];
}

export interface ImageGenerationSettings {
  cfgScale: number;
  steps: number;
  sampler: string;
  seed: number | string;
  outputFormat: string;
  width: number;
  height: number;
}

export interface PodcastPlan {
  structure: PodcastStructure[];
  audioSetup: string[];
  musicBed: MusicBedConfig | null;
  editingPlan: PodcastEditingPlan;
  delivery: string;
}

export interface PodcastStructure {
  segment: number;
  name: string;
  duration: string;
  description: string;
  cues: string[];
}

export interface MusicBedConfig {
  style: string;
  bpm: number;
  mood: string;
  instruments: string[];
}

export interface PodcastEditingPlan {
  software: string[];
  eq: string[];
  compression: string[];
  normalization: string;
  export: string;
}

export function generateId(): string {
  return `atlas-${crypto.randomUUID()}`;
}
