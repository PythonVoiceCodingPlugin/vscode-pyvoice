type RelativePath = string;

interface ProjectSettings {
  path: RelativePath;
  environmentPath?: RelativePath | null;
  sysPath?: RelativePath[] | null;
  addedSysPath: RelativePath[];
  smartSysPath: boolean;
}

interface StdlibImportsSettings {
  enabled: boolean;
}

interface ThirdPartyImportsSettings {
  enabled: boolean;
  includeDists: string[];
  excludeDists: string[];
}

interface ProjectImportsSettings {
  enabled: boolean;
}

interface SymbolsImportsSettings {
  enabled: boolean;
  modules: string[];
}

interface ImportSettings {
  stdlib: StdlibImportsSettings;
  thirdParty: ThirdPartyImportsSettings;
  project: ProjectImportsSettings;
  explicitSymbols: SymbolsImportsSettings;
}

interface ScopeSettings {
  enabled: boolean;
  signature: boolean;
}

interface ExpressionSettings {
  locals: ScopeSettings;
  nonlocals: ScopeSettings;
  globals: ScopeSettings;
  builtins: ScopeSettings;
  limit: number;
}

interface SpokenSettings {
  imports: ImportSettings;
  expressions: ExpressionSettings;
}

interface LoggingSettings {
  level: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL" | "debug" | "info" | "warning" | "error" | "critical";
}

export interface PyvoiceSettings {
  project: ProjectSettings;
  hints: SpokenSettings;
  logging: LoggingSettings;
}
