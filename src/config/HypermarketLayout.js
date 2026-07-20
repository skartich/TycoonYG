const CATEGORY_ROWS = [
  ['groceries', 'dairy', 'snacks', 'drinks', 'bakery'],
  ['frozen', 'produce', 'canned', 'ready-food'],
  ['meat', 'seafood', 'household', 'hygiene', 'pets'],
  ['kitchen', 'textile', 'toys', 'electronics'],
];

const SHELF_ROWS = [65, 195, 355, 485];
const SHELF_POSITION_ROWS = [
  [235, 315, 395, 475, 555, 635, 715, 795, 875, 955],
  [315, 395, 475, 555, 635, 715, 795, 875],
  [235, 315, 395, 475, 555, 635, 715, 795, 875, 955],
  [315, 395, 475, 555, 635, 715, 795, 875],
];

const shelfPositions = {};
const zoneRects = {};

CATEGORY_ROWS.forEach((categories, rowIndex) => {
  categories.forEach((category, categoryIndex) => {
    const firstColumn = categoryIndex * 2;
    const firstX = SHELF_POSITION_ROWS[rowIndex][firstColumn];
    const secondX = SHELF_POSITION_ROWS[rowIndex][firstColumn + 1];
    const y = SHELF_ROWS[rowIndex];
    shelfPositions[`hyper-${category}-a`] = { x: firstX, y };
    shelfPositions[`hyper-${category}-b`] = { x: secondX, y };
    zoneRects[`hyper-${category}`] = {
      x: firstX - 38,
      y: y - 48,
      w: secondX - firstX + 76,
      h: 104,
    };
  });
});

export const HYPERMARKET_CATEGORIES = Object.freeze(CATEGORY_ROWS.flat());

export const HYPERMARKET_LAYOUT = Object.freeze({
  debugNavigation: false,
  canvas: { width: 1280, height: 720 },
  hud: { height: 92 },
  sidePanel: { x: 1008, width: 272, collapsedWidth: 44 },
  viewport: { x: 0, y: 92, width: 1008, height: 628 },
  world: { x: 0, y: 0, width: 1008, height: 628 },
  room: { x: 18, y: 18, width: 970, height: 594 },
  walls: {
    top: { x: 503, y: 22, width: 970, height: 16 },
    left: { x: 22, y: 315, width: 16, height: 594 },
    right: { x: 984, y: 315, width: 16, height: 594 },
    bottomLeft: { x: 241, y: 608, width: 447, height: 16 },
    bottomRight: { x: 856, y: 608, width: 264, height: 16 },
  },
  shelf: {
    width: 70,
    height: 90,
    imageY: 4,
    imageHeight: 76,
    blockerWidth: 62,
    blockerHeight: 20,
    blockerY: 31,
    customerSpotY: 60,
    progressWidth: 62,
    progressHeight: 20,
    progressY: -45,
    rows: SHELF_ROWS,
    positionRows: SHELF_POSITION_ROWS,
    positions: shelfPositions,
  },
  zones: { rects: zoneRects },
  aisles: {
    sideX: 185,
    rowYs: [125, 255, 415, 545],
    endX: 965,
    connectorXs: [185, 595],
    columns: [
      { maxX: 500, connectorX: 185 },
      { connectorX: 595 },
    ],
    roadWidth: 20,
  },
  checkout: {
    terminalPositions: [
      { x: 82, y: 105 },
      { x: 82, y: 235 },
      { x: 82, y: 395 },
      { x: 82, y: 525 },
    ],
    terminalSpots: [
      { x: 145, y: 125 },
      { x: 145, y: 255 },
      { x: 145, y: 415 },
      { x: 145, y: 545 },
    ],
    sideLaneX: 185,
    waitingStartY: 570,
    waitingStepY: -24,
    displayWidth: 76,
    displayHeight: 82,
    blockerWidth: 54,
    blockerHeight: 26,
    blockerY: 20,
  },
  entrance: { x: 595, y: 572, width: 236, height: 86 },
  entranceWaypoint: { x: 595, y: 570 },
  entranceRoadWaypoint: { x: 595, y: 545 },
  customerSpawn: { x: 595, y: 596 },
  playerSpawn: { x: 595, y: 520 },
  teleport: { x: 595, y: 600, width: 188, height: 22 },
  promoIslands: [
    { x: 350, y: 320, asset: 'hypermarket-promo-drinks', width: 74, height: 68 },
    { x: 455, y: 320, asset: 'hypermarket-promo-snacks', width: 70, height: 68 },
    { x: 735, y: 320, asset: 'hypermarket-promo-household', width: 76, height: 68 },
    { x: 840, y: 320, asset: 'hypermarket-promo-electronics', width: 72, height: 68 },
  ],
  decorations: {
    wallPlants: [
      { x: 43, y: 58 },
      { x: 963, y: 58 },
      { x: 43, y: 568 },
      { x: 963, y: 568 },
    ],
    entranceTopiaries: [
      { x: 452, y: 570 },
      { x: 738, y: 570 },
    ],
    entranceBollards: [
      { x: 480, y: 574 },
      { x: 710, y: 574 },
    ],
    trash: { x: 920, y: 568 },
  },
});
