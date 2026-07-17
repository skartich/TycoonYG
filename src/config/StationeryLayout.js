const SHELF_IDS = [
  ['stationery-notebooks-a', 'stationery-notebooks-b', 'stationery-writing-a', 'stationery-writing-b', 'stationery-markers-a', 'stationery-markers-b'],
  ['stationery-paper-a', 'stationery-paper-b', 'stationery-folders-a', 'stationery-folders-b', 'stationery-school-a', 'stationery-school-b'],
  ['stationery-art-a', 'stationery-art-b', 'stationery-desk-a', 'stationery-desk-b', 'stationery-envelopes-a', 'stationery-envelopes-b'],
];

const SHELF_COLUMNS = [300, 410, 530, 640, 760, 870];
const SHELF_ROWS = [130, 295, 460];

const shelfPositions = Object.fromEntries(
  SHELF_IDS.flatMap((row, rowIndex) => row.map((id, columnIndex) => [
    id,
    { x: SHELF_COLUMNS[columnIndex], y: SHELF_ROWS[rowIndex] },
  ])),
);

const zoneRows = [68, 233, 398];
const zoneColumns = [248, 478, 708];
const zoneIds = [
  ['stationery-starter', 'stationery-writing', 'stationery-markers'],
  ['stationery-paper', 'stationery-folders', 'stationery-school'],
  ['stationery-art', 'stationery-desk', 'stationery-envelopes'],
];

const zoneRects = Object.fromEntries(
  zoneIds.flatMap((row, rowIndex) => row.map((id, columnIndex) => [
    id,
    { x: zoneColumns[columnIndex], y: zoneRows[rowIndex], w: 214, h: 142 },
  ])),
);

const shelfContentCropTops = {
  'stationery-notebooks-a': 38,
  'stationery-notebooks-b': 38,
  'stationery-writing-a': 40,
  'stationery-writing-b': 39,
  'stationery-markers-a': 42,
  'stationery-markers-b': 40,
  'stationery-paper-a': 41,
  'stationery-paper-b': 43,
  'stationery-folders-a': 45,
  'stationery-folders-b': 43,
  'stationery-school-a': 35,
  'stationery-school-b': 40,
  'stationery-art-a': 35,
  'stationery-art-b': 36,
  'stationery-desk-a': 35,
  'stationery-desk-b': 45,
  'stationery-envelopes-a': 35,
  'stationery-envelopes-b': 40,
};

export const STATIONERY_LAYOUT = Object.freeze({
  debugNavigation: false,
  canvas: { width: 1280, height: 720 },
  hud: { height: 92 },
  sidePanel: { x: 1008, width: 272, collapsedWidth: 44 },
  viewport: { x: 0, y: 92, width: 1008, height: 628 },
  world: { x: 0, y: 0, width: 1008, height: 628, padding: 18 },
  room: { x: 18, y: 18, width: 970, height: 594, innerPadding: 20 },
  shelf: {
    width: 84,
    height: 118,
    blockerWidth: 72,
    blockerHeight: 24,
    blockerY: 38,
    customerSpotY: 68,
    progressWidth: 76,
    progressHeight: 24,
    progressY: -54,
    contentCropTops: shelfContentCropTops,
    imageRepairs: {
      'stationery-folders-b': { mirrorRightEdgeWidth: 11 },
    },
    rows: SHELF_ROWS,
    columns: SHELF_COLUMNS,
    positions: shelfPositions,
  },
  zones: { rects: zoneRects },
  aisles: {
    sideX: 210,
    rowYs: [198, 363, 528],
    endX: 935,
    connectorXs: [210, 530, 760],
    columns: [
      { maxX: 470, connectorX: 210 },
      { maxX: 700, connectorX: 530 },
      { connectorX: 760 },
    ],
    switches: [
      {
        id: 'middleShelfColumnDetour',
        blockingShelfIds: ['stationery-folders-a', 'stationery-desk-a'],
        originalConnectorX: 530,
        detourConnectorX: 475,
      },
      {
        id: 'rightShelfColumnDetour',
        blockingShelfIds: ['stationery-school-a', 'stationery-envelopes-a'],
        originalConnectorX: 760,
        detourConnectorX: 705,
      },
    ],
    roadWidth: 22,
  },
  checkout: {
    terminalPositions: [
      { x: 88, y: 175 },
      { x: 88, y: 325 },
      { x: 88, y: 475 },
    ],
    terminalSpots: [
      { x: 145, y: 200 },
      { x: 145, y: 350 },
      { x: 145, y: 500 },
    ],
    sideLaneX: 210,
    waitingStartY: 548,
    waitingStepY: -26,
    displayWidth: 82,
    displayHeight: 96,
    textureCrop: { x: 0, y: 0, width: 128, height: 166 },
  },
  entrance: { x: 600, y: 566, width: 218, height: 88 },
  entranceWaypoint: { x: 600, y: 566 },
  entranceRoadWaypoint: { x: 600, y: 528 },
  customerSpawn: { x: 600, y: 588 },
  playerSpawn: { x: 600, y: 495 },
  departmentSigns: [
    { x: 355, y: 42, text: 'Тетради' },
    { x: 585, y: 42, text: 'Ручки' },
    { x: 815, y: 42, text: 'Маркеры' },
  ],
  decorationZones: [
    { id: 'plant-top', x: 42, y: 78 },
    { id: 'boxes-service', x: 45, y: 570 },
    { id: 'trash-exit', x: 914, y: 575 },
    { id: 'ad-stand', x: 955, y: 112 },
    { id: 'plant-exit', x: 955, y: 570 },
  ],
});
