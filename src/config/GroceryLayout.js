const SHELF_COLUMNS = [270, 395, 525, 650, 780, 910];
const SHELF_ROWS = [90, 255, 420];

const zoneRows = [22, 187, 352];
const zoneColumns = [210, 465, 720];
const zoneIds = [
  ['starter', 'dairy', 'snacks'],
  ['drinks', 'bakery', 'frozen'],
  ['produce', 'canned', 'ready-food'],
];

const zoneRects = Object.fromEntries(
  zoneIds.flatMap((row, rowIndex) => row.map((id, columnIndex) => [
    id,
    { x: zoneColumns[columnIndex], y: zoneRows[rowIndex], w: 245, h: 140 },
  ])),
);

export const GROCERY_LAYOUT = Object.freeze({
  debugNavigation: false,
  canvas: { width: 1280, height: 720 },
  sidePanel: { x: 1008, width: 272, collapsedWidth: 44 },
  viewport: { x: 0, y: 92, width: 1008, height: 628 },
  world: { x: 0, y: 0, width: 1008, height: 628 },
  room: { x: 18, y: 18, width: 970, height: 594 },
  walls: {
    top: { x: 503, y: 22, width: 970, height: 16 },
    left: { x: 22, y: 315, width: 16, height: 594 },
    right: { x: 984, y: 315, width: 16, height: 594 },
    bottomLeft: { x: 233, y: 608, width: 430, height: 16 },
    bottomRight: { x: 861, y: 608, width: 254, height: 16 },
  },
  entranceGap: { x: 448, y: 600, width: 286, height: 28 },
  shelf: {
    width: 100,
    height: 122,
    imageY: 7,
    imageHeight: 104,
    blockerWidth: 88,
    blockerHeight: 26,
    blockerY: 39,
    customerSpotY: 68,
    progressWidth: 80,
    progressHeight: 25,
    progressY: -58,
    rows: SHELF_ROWS,
    columns: SHELF_COLUMNS,
  },
  zones: { rects: zoneRects },
  aisles: {
    sideX: 185,
    rowYs: [158, 323, 488],
    endX: 955,
    connectorXs: [185, 590, 955],
    columns: [
      { maxX: 455, connectorX: 185 },
      { maxX: 715, connectorX: 590 },
      { connectorX: 955 },
    ],
    roadWidth: 22,
  },
  checkout: {
    terminalPositions: [
      { x: 88, y: 140 },
      { x: 88, y: 305 },
      { x: 88, y: 470 },
    ],
    terminalSpots: [
      { x: 145, y: 158 },
      { x: 145, y: 323 },
      { x: 145, y: 488 },
    ],
    sideLaneX: 185,
    waitingStartY: 526,
    waitingStepY: 26,
    displayWidth: 84,
    displayHeight: 94,
    blockerWidth: 62,
    blockerHeight: 30,
    blockerY: 24,
  },
  entrance: { x: 590, y: 566, width: 246, height: 92 },
  entranceWaypoint: { x: 590, y: 566 },
  entranceRoadWaypoint: { x: 590, y: 488 },
  customerSpawn: { x: 590, y: 592 },
  playerSpawn: { x: 590, y: 520 },
  teleport: { x: 590, y: 596, width: 210, height: 24 },
  decorations: {
    wallPlants: [
      { x: 45, y: 55 },
      { x: 961, y: 55 },
    ],
    entranceTopiaries: [
      { x: 442, y: 570 },
      { x: 738, y: 570 },
    ],
    entranceBollards: [
      { x: 468, y: 574 },
      { x: 712, y: 574 },
    ],
    trash: { x: 930, y: 566 },
  },
});
