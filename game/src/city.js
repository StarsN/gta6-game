// The city of Solmar: its roads, blocks, buildings, parks, beach and docks, all
// generated from one seed, plus the static picture the renderer paints each frame.
// Buildings are solid rectangles; roads, sidewalks, parks and the beach are open.
import { LANE, PALETTE, ROADS, ROAD_WIDTH, WORLD } from './config.js';
import { clamp, pick, range, rangeInt } from './random.js';

const BLOCK = 400;
const HALF_ROAD = ROAD_WIDTH / 2;

function blockIndexAt(coord) {
  return Math.floor(coord / BLOCK);
}

function roadCentre(roadIndex) {
  return ROADS[roadIndex];
}

/** Is the point on a road (including the intersection squares)? */
export function isOnRoad(x, y) {
  for (const r of ROADS) {
    if (Math.abs(x - r) <= HALF_ROAD + 6) return true;
    if (Math.abs(y - r) <= HALF_ROAD + 6) return true;
  }
  return false;
}

/** The nearest road line coordinate on one axis. */
export function nearestRoad(coord) {
  let best = ROADS[0];
  for (const r of ROADS) if (Math.abs(r - coord) < Math.abs(best - coord)) best = r;
  return best;
}

/** Distance to the nearest road centreline (either axis). */
export function distanceToRoad(x, y) {
  let best = Infinity;
  for (const r of ROADS) {
    best = Math.min(best, Math.abs(x - r), Math.abs(y - r));
  }
  return best;
}

export function createCity(random) {
  const buildings = [];
  const parks = [];
  const parkingLots = [];
  const trees = [];
  const containers = [];
  const colliders = [];
  const lots = [];

  // Blocks sit between the roads: block i spans [ROADS[i]+44, ROADS[i+1]-44].
  // The south strip is beach and water; the east strip is the docks.
  const specials = {
    '1,1': 'safehouse',
    '2,5': 'hospital',
    '5,2': 'police',
    '4,4': 'bank',
    '6,6': 'respray',
    '3,3': 'plaza',
  };

  for (let bx = 0; bx < 7; bx += 1) {
    for (let by = 0; by < 7; by += 1) {
      const x0 = ROADS[bx] + HALF_ROAD + 8;
      const y0 = ROADS[by] + HALF_ROAD + 8;
      const size = BLOCK - ROAD_WIDTH - 16;
      const key = `${bx},${by}`;
      const kind = specials[key];
      if (bx === 6 && by === 3) {
        // Docks: container yard with a pier.
        for (let i = 0; i < 10; i += 1) {
          const cx = x0 + 20 + (i % 5) * 62;
          const cy = y0 + 30 + Math.floor(i / 5) * 90;
          const c = { x: cx, y: cy, w: 52, h: 26, color: pick(random, ['#b03a2e', '#1f618d', '#7d6608', '#1e8449', '#6c3483']) };
          containers.push(c);
          colliders.push(c);
        }
        continue;
      }
      if (kind === 'plaza') {
        parks.push({ x: x0, y: y0, w: size, h: size, plaza: true });
        for (let i = 0; i < 8; i += 1) trees.push({ x: x0 + range(random, 30, size - 30), y: y0 + range(random, 30, size - 30), r: range(random, 10, 16) });
        continue;
      }
      if (kind === 'park' || random() < 0.12) {
        parks.push({ x: x0, y: y0, w: size, h: size, plaza: false });
        for (let i = 0; i < 10; i += 1) trees.push({ x: x0 + range(random, 30, size - 30), y: y0 + range(random, 30, size - 30), r: range(random, 10, 18) });
        continue;
      }
      if (random() < 0.14) {
        parkingLots.push({ x: x0, y: y0, w: size, h: size });
        continue;
      }
      // A block of buildings: one or two rows of lots.
      const downtown = bx >= 3 && bx <= 4 && by >= 3 && by <= 4;
      const rows = random() < 0.5 ? 1 : 2;
      const rowH = size / rows;
      for (let row = 0; row < rows; row += 1) {
        const cols = rangeInt(random, 1, 2);
        const colW = size / cols;
        for (let col = 0; col < cols; col += 1) {
          const pad = 14;
          const b = {
            x: x0 + col * colW + pad,
            y: y0 + row * rowH + pad,
            w: colW - pad * 2,
            h: rowH - pad * 2,
            floors: downtown ? rangeInt(random, 8, 18) : rangeInt(random, 1, 4),
            downtown,
            special: kind ?? null,
            hue: pick(random, [0, 1, 2]),
          };
          buildings.push(b);
          colliders.push(b);
          lots.push(b);
        }
      }
    }
  }

  // Named places the missions and the HUD point at (block centres).
  const atBlock = (bx, by) => ({ x: ROADS[bx] + 200, y: ROADS[by] + 200 });
  const places = {
    safehouse: { ...atBlock(1, 1), label: 'Safehouse' },
    hospital: { ...atBlock(2, 5), label: 'Solmar General' },
    police: { ...atBlock(5, 2), label: 'SCPD HQ' },
    bank: { ...atBlock(4, 4), label: 'Solmar Reserve Bank' },
    respray: { ...atBlock(6, 6), label: 'Quick Respray' },
    docks: { x: 3100, y: ROADS[3] + 200, label: 'East Docks' },
    beach: { x: 1500, y: 3080, label: 'Solmar Beach' },
    plaza: { ...atBlock(3, 3), label: 'Founders Plaza' },
    airport: { ...atBlock(6, 1), label: 'Solmar Airfield' },
  };

  const city = {
    buildings, parks, parkingLots, trees, containers, colliders, places,
    beachY: ROADS[7] + HALF_ROAD,
    docksX: ROADS[7] + HALF_ROAD,
    docksBlock: { x: ROADS[6] + HALF_ROAD + 8, y: ROADS[3] + HALF_ROAD + 8, w: BLOCK - ROAD_WIDTH - 16, h: BLOCK - ROAD_WIDTH - 16 },
  };

  city.dayLayer = renderCityLayer(city, false);
  city.nightLayer = renderCityLayer(city, true);
  return city;
}

/** Paint the whole static city once, to an offscreen canvas. Night paints only the lit windows. */
function renderCityLayer(city, night) {
  const canvas = document.createElement('canvas');
  canvas.width = WORLD;
  canvas.height = WORLD;
  const ctx = canvas.getContext('2d');

  // Ground.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, WORLD, WORLD);

  // Beach and water along the south edge.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(0, city.beachY, WORLD, WORLD - city.beachY);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(0, city.beachY + 90, WORLD, WORLD - city.beachY - 90);
  ctx.fillStyle = PALETTE.waterDeep;
  for (let x = 0; x < WORLD; x += 90) {
    ctx.fillRect(x, city.beachY + 150 + ((x * 7) % 60), 46, 5);
  }
  // Pier.
  ctx.fillStyle = '#8d6e63';
  ctx.fillRect(1460, city.beachY - 130, 80, 220);

  // Docks ground (east strip).
  ctx.fillStyle = '#5d6d7e';
  ctx.fillRect(city.docksX, 0, WORLD - city.docksX, city.beachY);

  if (!night) {
    // Parks.
    for (const p of city.parks) {
      ctx.fillStyle = p.plaza ? '#b0a58e' : PALETTE.parkGrass;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      if (p.plaza) {
        ctx.fillStyle = '#8fa8bf';
        ctx.beginPath();
        ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 34, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Parking lots.
    for (const p of city.parkingLots) {
      ctx.fillStyle = '#55595f';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = '#d5d8dc';
      ctx.lineWidth = 2;
      for (let x = p.x + 24; x < p.x + p.w - 20; x += 44) {
        ctx.beginPath();
        ctx.moveTo(x, p.y + 14);
        ctx.lineTo(x, p.y + 44);
        ctx.stroke();
      }
    }
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const r of ROADS) {
      ctx.fillRect(0, r - HALF_ROAD, WORLD, ROAD_WIDTH);
      ctx.fillRect(r - HALF_ROAD, 0, ROAD_WIDTH, WORLD);
    }
    // Sidewalk edges.
    ctx.strokeStyle = PALETTE.sidewalk;
    ctx.lineWidth = 10;
    for (const r of ROADS) {
      ctx.beginPath();
      ctx.moveTo(0, r - HALF_ROAD - 5);
      ctx.lineTo(WORLD, r - HALF_ROAD - 5);
      ctx.moveTo(0, r + HALF_ROAD + 5);
      ctx.lineTo(WORLD, r + HALF_ROAD + 5);
      ctx.moveTo(r - HALF_ROAD - 5, 0);
      ctx.lineTo(r - HALF_ROAD - 5, WORLD);
      ctx.moveTo(r + HALF_ROAD + 5, 0);
      ctx.lineTo(r + HALF_ROAD + 5, WORLD);
      ctx.stroke();
    }
    // Lane dashes.
    ctx.strokeStyle = PALETTE.laneLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    for (const r of ROADS) {
      ctx.beginPath();
      ctx.moveTo(0, r);
      ctx.lineTo(WORLD, r);
      ctx.moveTo(r, 0);
      ctx.lineTo(r, WORLD);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Crosswalks at every intersection.
    ctx.fillStyle = '#e5e8e8';
    for (const rx of ROADS) {
      for (const ry of ROADS) {
        for (let i = -3; i <= 3; i += 1) {
          ctx.fillRect(rx + i * 9 - 3, ry - HALF_ROAD - 2, 5, 8);
          ctx.fillRect(rx + i * 9 - 3, ry + HALF_ROAD - 6, 5, 8);
          ctx.fillRect(rx - HALF_ROAD - 2, ry + i * 9 - 3, 8, 5);
          ctx.fillRect(rx + HALF_ROAD - 6, ry + i * 9 - 3, 8, 5);
        }
      }
    }
    // The container yard is asphalt, not grass.
    ctx.fillStyle = '#5d6d7e';
    ctx.fillRect(city.docksBlock.x, city.docksBlock.y, city.docksBlock.w, city.docksBlock.h);
    // Trees.
    for (const t of city.trees) {
      ctx.fillStyle = '#2e7d32';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1b5e20';
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 3, t.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    // Containers at the docks.
    for (const c of city.containers) {
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x, c.y, c.w, c.h);
    }
    // Buildings: roof, edge, and a few roof details.
    for (const b of city.buildings) {
      ctx.fillStyle = b.downtown ? PALETTE.downtownRoof : b.hue === 0 ? PALETTE.buildingRoof : b.hue === 1 ? PALETTE.buildingRoof2 : '#8a7f70';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 10);
      if (b.floors >= 8) {
        ctx.fillStyle = '#3d4852';
        ctx.fillRect(b.x + b.w / 2 - 12, b.y + b.h / 2 - 12, 24, 24);
      }
      if (b.special === 'hospital') {
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(b.x + b.w / 2 - 22, b.y + b.h / 2 - 7, 44, 14);
        ctx.fillRect(b.x + b.w / 2 - 7, b.y + b.h / 2 - 22, 14, 44);
      }
      if (b.special === 'police') {
        ctx.fillStyle = '#2e86c1';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SCPD', b.x + b.w / 2, b.y + b.h / 2 + 7);
      }
      if (b.special === 'bank') {
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', b.x + b.w / 2, b.y + b.h / 2 + 8);
      }
    }
  } else {
    // Night: only the lit windows, drawn over the day layer with low alpha.
    for (const b of city.buildings) {
      const cols = Math.max(2, Math.floor(b.w / 26));
      const rows = Math.max(2, Math.floor(b.h / 26));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          if ((cx * 7 + cy * 13 + b.floors) % 3 === 0) {
            ctx.fillStyle = PALETTE.windowLit;
            ctx.fillRect(b.x + 8 + cx * ((b.w - 16) / cols), b.y + 8 + cy * ((b.h - 16) / rows), 9, 12);
          }
        }
      }
    }
  }
  return canvas;
}

/** Push a circle out of every building it overlaps; returns true when a push happened. */
export function resolveCircleCollisions(city, x, y, radius) {
  let pushed = false;
  for (const b of city.colliders) {
    if (x + radius < b.x || x - radius > b.x + b.w || y + radius < b.y || y - radius > b.y + b.h) continue;
    const nx = clamp(x, b.x, b.x + b.w);
    const ny = clamp(y, b.y, b.y + b.h);
    let dx = x - nx;
    let dy = y - ny;
    let d = Math.sqrt(dx * dx + dy * dy);
    if (d === 0) {
      // Centre inside the rectangle: push out along the smallest penetration.
      const left = x - b.x;
      const right = b.x + b.w - x;
      const top = y - b.y;
      const bottom = b.y + b.h - y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) { x = b.x - radius; }
      else if (m === right) { x = b.x + b.w + radius; }
      else if (m === top) { y = b.y - radius; }
      else { y = b.y + b.h + radius; }
    } else {
      dx /= d;
      dy /= d;
      x = nx + dx * radius;
      y = ny + dy * radius;
    }
    pushed = true;
  }
  return { x, y, pushed };
}

/** True when the circle overlaps any building. */
export function hitsBuilding(city, x, y, radius) {
  for (const b of city.colliders) {
    if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return true;
  }
  return false;
}

/** The nearest point on a road to a place: the street outside it, always open. */
export function approachPoint(place) {
  const dx = Math.abs(place.x - nearestRoad(place.x));
  const dy = Math.abs(place.y - nearestRoad(place.y));
  if (dx <= dy) return { x: nearestRoad(place.x), y: place.y };
  return { x: place.x, y: nearestRoad(place.y) };
}

/** A random point on a road, for traffic and pedestrian spawns. */
export function randomRoadPoint(random) {
  if (random() < 0.5) {
    return { x: ROADS[Math.floor(random() * ROADS.length)] + (random() < 0.5 ? -LANE : LANE), y: range(random, 60, WORLD - 60) };
  }
  return { x: range(random, 60, WORLD - 60), y: ROADS[Math.floor(random() * ROADS.length)] + (random() < 0.5 ? -LANE : LANE) };
}

/** A random sidewalk point (beside a road, off the driving lane). */
export function randomSidewalkPoint(random) {
  const vertical = random() < 0.5;
  const road = ROADS[Math.floor(random() * ROADS.length)];
  const off = (random() < 0.5 ? -1 : 1) * (HALF_ROAD + 12);
  if (vertical) return { x: road + off, y: range(random, 60, WORLD - 60) };
  return { x: range(random, 60, WORLD - 60), y: road + off };
}

export { blockIndexAt, roadCentre };
