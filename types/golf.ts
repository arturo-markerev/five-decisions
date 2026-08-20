/**
 * FIVE DECISIONS — modelo de datos.
 * Regla: nada aqui asume geometria real de ningun campo.
 * La geometria se carga por JSON y se marca con dataQuality.
 */

/* ------------------------------------------------------------------ */
/* Basicos                                                             */
/* ------------------------------------------------------------------ */

export type Confidence = "LOW" | "MEDIUM" | "HIGH";

/** Riesgo ESTRATEGICO. Nunca se usa para calificar un swing. */
export type RiskLevel = "GREEN" | "YELLOW" | "RED";

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";

export type RecoveryDifficulty = "EASY" | "NORMAL" | "DIFFICULT" | "NO_RECOVERY";

export type DataQuality = "EMPTY" | "MOCK" | "PARTIAL" | "REAL";

export type Lie =
  | "TEE"
  | "FAIRWAY"
  | "LIGHT_ROUGH"
  | "HEAVY_ROUGH"
  | "BUNKER"
  | "TREES"
  | "RECOVERY"
  | "GREEN"
  | "OTHER";

export const LIE_LABELS: Record<Lie, string> = {
  TEE: "Tee",
  FAIRWAY: "Fairway",
  LIGHT_ROUGH: "Light rough",
  HEAVY_ROUGH: "Heavy rough",
  BUNKER: "Bunker",
  TREES: "Trees",
  RECOVERY: "Recovery",
  GREEN: "Green",
  OTHER: "Other",
};

export type LateralSide = "LEFT" | "RIGHT" | "CENTER" | "BOTH" | "CROSS";

export type MissDirection = "LEFT" | "RIGHT" | "SHORT" | "LONG" | "NONE";

/* ------------------------------------------------------------------ */
/* Jugador                                                             */
/* ------------------------------------------------------------------ */

export type ClubCategory =
  | "DRIVER"
  | "FAIRWAY_WOOD"
  | "HYBRID"
  | "IRON"
  | "WEDGE"
  | "PUTTER";

export interface Club {
  id: string;
  clubName: string;
  category: ClubCategory;
  /** Distancia que consigo casi siempre. */
  conservativeDistance: number;
  /** LA distancia estrategica. El motor SIEMPRE planifica con esta. */
  planningDistance: number;
  /** Mi mejor golpe. El motor NUNCA planifica con esta. */
  goodStrikeDistance: number;
  leftDispersionYards: number;
  rightDispersionYards: number;
  shortDispersionYards: number;
  longDispersionYards: number;
  typicalMiss: MissDirection;
  confidence: Confidence;
  enabled: boolean;
  /** ESTIMATE = numeros puestos para que el motor funcione, no medidos. */
  dispersionSource: "ESTIMATE" | "OBSERVED";
  needsCalibration: boolean;
  notes: string;
}

export interface PlayerProfile {
  name: string;
  handicap: number;
  clubs: Club[];
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Campo                                                               */
/* ------------------------------------------------------------------ */

export interface Point {
  x: number;
  y: number;
}

export type HazardType =
  | "WATER"
  | "PENALTY"
  | "OB"
  | "BUNKER"
  | "TREES"
  | "RECOVERY"
  | "THROUGH_FAIRWAY";

/**
 * Hazard modelado en el eje del hoyo (corridor model).
 * startDistanceFromTee / endDistanceFromTee = banda longitudinal.
 * lateralStart / lateralEnd = distancia lateral desde el centro del fairway.
 * side CROSS = cruza todo el ancho (forced carry).
 */
export interface Hazard {
  id: string;
  type: HazardType;
  side: LateralSide;
  startDistanceFromTee: number;
  endDistanceFromTee: number;
  /** yardas desde el centro donde EMPIEZA el hazard hacia ese lado */
  lateralStart: number;
  /** yardas desde el centro donde TERMINA (Infinity practico = 100) */
  lateralEnd: number;
  carryRequired: number | null;
  severity: Severity;
  /** golpes de penalidad al entrar. OB = 2 (stroke and distance aproximado). */
  penaltyCost: number;
  recoveryDifficulty: RecoveryDifficulty;
  notes: string;
  polygon?: Point[];
}

export type GreenSide = "LEFT" | "RIGHT" | "SHORT" | "LONG";

export interface GreensideHazard {
  id: string;
  type: HazardType;
  side: GreenSide;
  severity: Severity;
  penaltyCost: number;
  recoveryDifficulty: RecoveryDifficulty;
  notes: string;
}

export interface Zone {
  id: string;
  name: string;
  startDistanceFromTee: number;
  endDistanceFromTee: number;
  notes: string;
}

export interface Hole {
  holeNumber: number;
  par: number;
  handicapIndex: number;
  whiteTeeYardage: number;
  /** ancho util del fairway (yardas, total) */
  fairwayWidthYards: number;
  fairwayStart: number;
  fairwayEnd: number;
  greenWidth: number;
  greenDepth: number;
  greenSafeSide: GreenSide | "NONE";
  greenBadSide: GreenSide | "NONE";
  greensideHazards: GreensideHazard[];
  hazards: Hazard[];
  forcedCarry: number | null;
  layupZones: Zone[];
  preferredLandingZones: Zone[];
  elevationChangeYards: number;
  strategicNotes: string;
  dataQuality: DataQuality;
  /** Geometria real opcional — se llena en Course Builder / Phase 5-6. */
  teeCoordinates?: Point | null;
  greenCenter?: Point | null;
  greenPolygon?: Point[];
  fairwayPolygon?: Point[];
  roughAreas?: Point[][];
  water?: Point[][];
  outOfBounds?: Point[][];
  trees?: Point[][];
  recoveryZones?: Point[][];
  slopes?: string;
  referenceImage?: string | null;
}

export interface Tee {
  id: string;
  name: string;
  color: string;
}

export interface Course {
  id: string;
  name: string;
  /** Si el nombre oficial no esta confirmado, se marca aqui. */
  nameConfirmed: boolean;
  location: string;
  tees: Tee[];
  holes: Hole[];
  dataQuality: DataQuality;
  source: "BUNDLED" | "USER";
  notes: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Ronda                                                               */
/* ------------------------------------------------------------------ */

export type FlagPosition =
  | "FRONT_LEFT"
  | "FRONT_CENTER"
  | "FRONT_RIGHT"
  | "MIDDLE_LEFT"
  | "MIDDLE_CENTER"
  | "MIDDLE_RIGHT"
  | "BACK_LEFT"
  | "BACK_CENTER"
  | "BACK_RIGHT"
  | "UNKNOWN";

export type ShotResultCode =
  | "FAIRWAY"
  | "LEFT_ROUGH"
  | "RIGHT_ROUGH"
  | "GREEN"
  | "SHORT"
  | "LONG"
  | "LEFT"
  | "RIGHT"
  | "BUNKER"
  | "TREES"
  | "WATER"
  | "OB"
  | "OTHER";

export interface ShotRecord {
  roundId: string;
  courseId: string;
  holeNumber: number;
  shotNumber: number;
  club: string;
  recommendedClub: string;
  selectedClub: string;
  followedRecommendation: boolean;
  planningDistance: number;
  laserDistance: number | null;
  distanceToGreen: number | null;
  lie: Lie;
  target: string;
  targetOffsetYards: number;
  safeMiss: string;
  dangerMiss: string;
  flagPosition: FlagPosition;
  flagRisk: RiskLevel;
  result: ShotResultCode;
  penalty: number;
  /** true si falle, pero del lado que el plan marcaba como seguro. */
  correctMiss: boolean | null;
  strategyRisk: RiskLevel;
  decisionConfidence: Confidence;
  notes: string;
  timestamp: string;
}

export type PuttResult = "HOLED" | "UNDER_1_STEP" | "1_STEP" | "2_STEPS" | "3_PLUS_STEPS";

export interface HoleRecord {
  holeNumber: number;
  par: number;
  flagPosition: FlagPosition;
  shots: ShotRecord[];
  firstPuttSteps: number | null;
  firstPuttResult: PuttResult | null;
  putts: number | null;
  penalties: number;
  score: number | null;
  completed: boolean;
}

export interface Round {
  id: string;
  courseId: string;
  courseName: string;
  teeId: string;
  teeName: string;
  hideScore: boolean;
  startedAt: string;
  finishedAt: string | null;
  currentHoleIndex: number;
  holes: HoleRecord[];
}

/* ------------------------------------------------------------------ */
/* Motor de decision                                                   */
/* ------------------------------------------------------------------ */

export type ShotIntent = "TEE_SHOT" | "APPROACH" | "ADVANCE" | "LAYUP" | "RECOVERY" | "SHORT_GAME";

export type PlayCategory = "GO_FOR_GREEN" | "ADVANCE" | "LAYUP" | "PITCH_OUT" | "STANDARD";

export interface DecisionAlternative {
  club: string;
  label: string;
  /** Solo bandas. Nunca "+0.73 strokes". */
  estimatedCost: "LOW" | "MEDIUM" | "HIGH";
  penaltyExposure: number;
  expectedRemainingDistance: number;
  note: string;
}

export interface Recommendation {
  recommendedClub: string;
  clubId: string;
  intent: ShotIntent;
  playCategory: PlayCategory;
  target: string;
  targetOffset: number;
  targetOffsetLabel: string;
  planningDistance: number;
  expectedRemainingDistance: number;
  safeMiss: string;
  dangerMiss: string;
  riskLevel: RiskLevel;
  flagRisk: RiskLevel;
  tigerFiveRisk: TigerFiveKey[];
  /** 1-3 frases. Se muestra solo en WHY?. */
  rationale: string;
  /** Caddie voice. Muy corto. */
  caddieLine: string;
  confidence: Confidence;
  penaltyProbability: number;
  fairwayProbability: number;
  greenProbability: number;
  alternatives: DecisionAlternative[];
  /** Debug interno; nunca se muestra como "strokes". */
  debugScore: number;
}

/* ------------------------------------------------------------------ */
/* Tiger Five H18                                                      */
/* ------------------------------------------------------------------ */

export type TigerFiveKey =
  | "PENALTY"
  | "DOUBLE_PLUS"
  | "THREE_PUTT"
  | "DOUBLE_SHORT_GAME"
  | "BAD_DECISION_INSIDE_150";

export const TIGER_FIVE_LABELS: Record<TigerFiveKey, string> = {
  PENALTY: "Penalty",
  DOUBLE_PLUS: "Double+",
  THREE_PUTT: "3-Putt",
  DOUBLE_SHORT_GAME: "Double Short",
  BAD_DECISION_INSIDE_150: "Bad <150",
};

export interface TigerFiveEvent {
  key: TigerFiveKey;
  holeNumber: number;
  detail: string;
  /** Solo aplica a DOUBLE_PLUS. */
  cause?: "DECISION" | "EXECUTION";
}

export type TigerFiveTally = Record<TigerFiveKey, number>;

/* ------------------------------------------------------------------ */
/* Aprendizaje                                                         */
/* ------------------------------------------------------------------ */

export type SampleBand = "INSUFFICIENT" | "EARLY" | "USABLE" | "RELIABLE";

export interface ClubLearning {
  clubName: string;
  shots: number;
  band: SampleBand;
  fairwayPct: number | null;
  greenPct: number | null;
  leftPct: number | null;
  rightPct: number | null;
  shortPct: number | null;
  longPct: number | null;
  penaltyPct: number | null;
  observedMedianDistance: number | null;
  observedDistanceSamples: number;
  currentPlanningDistance: number;
  suggestedPlanningDistance: number | null;
}

export interface HoleClubLearning {
  courseId: string;
  holeNumber: number;
  clubName: string;
  shots: number;
  penalties: number;
  fairways: number;
  band: SampleBand;
}

export interface CourseConfidence {
  courseId: string;
  courseName: string;
  rounds: number;
  geometryQuality: DataQuality;
  level: "Low" | "Medium" | "High";
}
