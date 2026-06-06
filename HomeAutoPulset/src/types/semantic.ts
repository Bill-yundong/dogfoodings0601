export type PriorityMode = 'security' | 'homeControl' | 'context_aware';

export type SceneType = 'home' | 'away' | 'sleep' | 'security' | 'movie' | 'dinner' | 'morning' | 'evening';

export interface SemanticRule {
  id: string;
  condition: string;
  securityAction: string;
  homeControlAction: string;
  conflictResolution: string;
  weight: number;
}

export interface SemanticMapping {
  id: string;
  sensorType: string;
  securityContext: string;
  homeControlContext: string;
  priority: PriorityMode;
  rules: SemanticRule[];
  description: string;
  enabled: boolean;
}

export interface Scene {
  id: string;
  name: string;
  type: SceneType;
  description: string;
  activeConditions: string[];
  securitySettings: Record<string, any>;
  homeControlSettings: Record<string, any>;
  conflictHandling: PriorityMode;
  enabled: boolean;
}

export interface ContextTransition {
  fromContext: string;
  toContext: string;
  transitionTime: number;
  affectedDevices: string[];
  potentialConflicts: string[];
  smoothTransition: boolean;
}

export interface ResolvedSemantics {
  originalSensorType: string;
  resolvedContext: string;
  securityInterpretation: string;
  homeControlInterpretation: string;
  recommendedAction: string;
  confidence: number;
  alternativeInterpretations: {
    context: string;
    confidence: number;
  }[];
}

export interface SemanticAlignmentResult {
  sensorId: string;
  timestamp: number;
  alignedValue: number;
  securityTags: string[];
  homeControlTags: string[];
  activeScene: string;
  conflictPotential: number;
  recommendations: string[];
}
