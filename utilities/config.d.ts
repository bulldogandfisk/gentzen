// Type declarations for `gentzen/config`.

export interface LoggingConfig {
    level: number;
    enableColors: boolean;
    enableTimestamps: boolean;
    enableLabels: boolean;
}

export interface ReasoningConfig {
    maxIterations: number;
    maxQueueSize: number;
    maxSteps: number;
    maxProofDepth: number;
}

export interface PerformanceConfig {
    cacheSize: number;
    enableCaching: boolean;
}

export interface ValidationConfig {
    strictMode: boolean;
}

export interface DisplayConfig {
    enableColors: boolean;
    showProgress: boolean;
}

export interface GentzenConfig {
    logging: LoggingConfig;
    reasoning: ReasoningConfig;
    performance: PerformanceConfig;
    validation: ValidationConfig;
    display: DisplayConfig;
}

export type ConfigSectionName = keyof GentzenConfig;
export type ConfigSection<K extends ConfigSectionName> = GentzenConfig[K];

export function getConfig(): GentzenConfig;
export function getConfigSection<K extends ConfigSectionName>(section: K): ConfigSection<K>;
export function updateConfig(updates: Partial<GentzenConfig>): GentzenConfig;
export function onConfigChange(callback: (config: GentzenConfig) => void): () => void;
