// Copy contract address buttons
document.querySelectorAll('.btn-copy').forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-copy-target');
    const el = document.getElementById(targetId);
    if (!el) return;
    navigator.clipboard.writeText(el.textContent.trim()).then(() => {
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = original; }, 1500);
    }).catch(() => {
      alert('Could not copy automatically — copy manually: ' + el.textContent.trim());
    });
  });
});

// Customizer: layered ROGGI part swapping + PFP download
const PART_FILES = {
  mouth: ['1.png', '2.png', '3.png', '4.png', '5.png', '6.png', '7.png', '8.png'],
  eyes: [
    'Eyes%201.png', 'Eyes%202.png', 'Eyes%20(3).png',
    'Eyes%20(4).png', 'Eyes%20(5).png', 'Eyes%20(6).png'
  ],
  clothes: [
    'clothes-1.png', 'clothes-2.png', 'clothes-3.png', 'clothes-4.png',
    'clothes-5.png', 'clothes-6.png', 'clothes-7.png', 'clothes-8.png'
  ],
  headwear: ['1.png', '2.png', '3.png', '4.png', '5.png']
};
const PART_FOLDERS = { mouth: 'Mouth', eyes: 'Eyes', clothes: 'Clothes', headwear: 'Headwear' };
const PART_TOTALS = Object.fromEntries(Object.keys(PART_FILES).map((part) => [part, PART_FILES[part].length]));
const partState = { mouth: 0, eyes: 0, clothes: 0, headwear: 0 };

// Mouth/eyes/headwear art is now exported full-canvas (same width as base,
// extra height above for headroom) and sits bottom-aligned in the taller
// preview frame — same treatment for all three, no per-part anchor needed.
// Clothes art is still cropped close to the base body's own 908x1093 canvas,
// so it's anchored relative to base's own 0-100% coordinate space instead
// (see FRAME_RATIO below for how that space maps into the taller frame).
const PART_ANCHORS = {
  clothes: { x: 50, y: 50, originX: 50, originY: 50, scale: 1 },
  eyes: { x: 50, originX: 50, scale: 1 },
  mouth: { x: 50, originX: 50, scale: 1 },
  headwear: { x: 50, originX: 50, scale: 1 }
};

// Bump this if a taller full-canvas export (headwear, mouth, eyes...) is ever added.
const CANVAS_H_FULL = 1435;

let baseNaturalW = 0;
let baseNaturalH = 0;

function layerElFor(part) {
  return document.getElementById('layer' + part.charAt(0).toUpperCase() + part.slice(1));
}

function partAssetPath(part, index) {
  return `assets/customizer/${PART_FOLDERS[part]}/${PART_FILES[part][index - 1]}`;
}

function positionBase(base) {
  if (!base.naturalWidth) return;
  baseNaturalW = base.naturalWidth;
  baseNaturalH = base.naturalHeight;
  const frameRatio = (baseNaturalH / CANVAS_H_FULL) * 100;
  base.style.width = '100%';
  base.style.left = '0';
  base.style.height = frameRatio + '%';
  base.style.top = (100 - frameRatio) + '%';
}

(() => {
  const base = layerElFor('base');
  if (!base) return;
  if (base.complete && base.naturalWidth) positionBase(base);
  else base.addEventListener('load', () => positionBase(base), { once: true });
})();

function positionLayer(layer, part) {
  const anchor = PART_ANCHORS[part];
  if (!anchor || !baseNaturalW || !baseNaturalH || !layer.naturalWidth) return;
  layer.style.width = (layer.naturalWidth / baseNaturalW) * 100 * anchor.scale + '%';
  layer.style.left = anchor.x + '%';

  if (part !== 'clothes') {
    // Full-canvas art: bottom-align to the frame, same as the base body.
    layer.style.height = (layer.naturalHeight / CANVAS_H_FULL) * 100 + '%';
    layer.style.top = '100%';
    layer.style.transform = `translate(-${anchor.originX}%, -100%)`;
    return;
  }

  const frameRatio = baseNaturalH / CANVAS_H_FULL;
  const frameTop = (1 - frameRatio) * 100;
  layer.style.height = (layer.naturalHeight / baseNaturalH) * 100 * anchor.scale * frameRatio + '%';
  layer.style.top = (frameTop + anchor.y * frameRatio) + '%';
  layer.style.transform = `translate(-${anchor.originX}%, -${anchor.originY}%)`;
}

function updateLayer(part) {
  const layer = layerElFor(part);
  if (!layer) return;
  const index = partState[part];
  if (index === 0) {
    layer.hidden = true;
    layer.removeAttribute('src');
    return;
  }
  layer.onload = () => { positionLayer(layer, part); layer.hidden = false; };
  layer.onerror = () => { layer.hidden = true; };
  layer.src = partAssetPath(part, index);
}

document.querySelectorAll('.control-row').forEach((row) => {
  const part = row.getAttribute('data-part');
  if (!PART_TOTALS[part]) return;
  const countEl = row.querySelector('.control-count');
  row.querySelectorAll('.control-arrow').forEach((arrow) => {
    arrow.addEventListener('click', () => {
      const dir = parseInt(arrow.getAttribute('data-dir'), 10);
      const total = PART_TOTALS[part];
      let next = partState[part] + dir;
      if (next < 0) next = total;
      if (next > total) next = 0;
      partState[part] = next;
      countEl.textContent = `${next} / ${total}`;
      updateLayer(part);
    });
  });
});

document.getElementById('randomize')?.addEventListener('click', () => {
  Object.keys(PART_TOTALS).forEach((part) => {
    const total = PART_TOTALS[part];
    const randomVal = Math.floor(Math.random() * (total + 1));
    partState[part] = randomVal;
    const row = document.querySelector(`.control-row[data-part="${part}"] .control-count`);
    if (row) row.textContent = `${randomVal} / ${total}`;
    updateLayer(part);
  });
});

// Flatten the visible layers onto a canvas and trigger a PNG download
document.getElementById('downloadPfp')?.addEventListener('click', () => {
  const baseImg = document.getElementById('layerBase');
  if (!baseImg) return;

  const finish = (canvasW, canvasH) => {
    // Draw on the extended (base + headroom) canvas so nothing gets cropped.
    const fullH = Math.round(canvasW * (CANVAS_H_FULL / baseNaturalW));
    const baseTopPx = fullH - canvasH;
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = fullH;
    const ctx = canvas.getContext('2d');
    const layerIds = ['layerBase', 'layerClothes', 'layerEyes', 'layerMouth', 'layerHeadwear'];

    const loaders = layerIds.map((id) => {
      const el = document.getElementById(id);
      if (!el || el.hidden || !el.getAttribute('src')) return Promise.resolve(null);
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = el.src;
      });
    });

    Promise.all(loaders).then((imgs) => {
      imgs.forEach((img, i) => {
        if (!img) return;
        const id = layerIds[i];
        if (id === 'layerBase') {
          ctx.drawImage(img, 0, baseTopPx, canvasW, canvasH);
          return;
        }
        const part = id.slice(5).toLowerCase();
        const anchor = PART_ANCHORS[part];
        if (!anchor) return;
        if (part !== 'clothes') {
          const w = img.naturalWidth * anchor.scale;
          const h = img.naturalHeight;
          const x = (anchor.x / 100) * canvasW - (anchor.originX / 100) * w;
          const y = fullH - h;
          ctx.drawImage(img, x, y, w, h);
          return;
        }
        const w = img.naturalWidth * anchor.scale;
        const h = img.naturalHeight * anchor.scale;
        const x = (anchor.x / 100) * canvasW - (anchor.originX / 100) * w;
        const y = baseTopPx + (anchor.y / 100) * canvasH - (anchor.originY / 100) * h;
        ctx.drawImage(img, x, y, w, h);
      });
      const link = document.createElement('a');
      link.download = 'my-roggi-pfp.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  };

  if (baseImg.complete && baseImg.naturalWidth) {
    finish(baseImg.naturalWidth, baseImg.naturalHeight);
  } else {
    baseImg.addEventListener('load', () => finish(baseImg.naturalWidth, baseImg.naturalHeight), { once: true });
  }
});
