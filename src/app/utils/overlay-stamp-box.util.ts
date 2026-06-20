import { DocumentOverlayId, DocumentStampOptions } from '../models/document-overlay.models';
import { pocStampBoxPdfLib } from '../services/port-of-call-coordinates';

/** ISO A4 portrait in pdf-lib points (origin bottom-left). */
export const A4_WIDTH_PT = 595.28;
export const A4_HEIGHT_PT = 842;

export const OVERLAY_ROTATIONS = [0, 90, 180, 270] as const;
export type OverlayRotation = (typeof OVERLAY_ROTATIONS)[number];

/** Stamp ≈ 17% of page width (~40 mm on A4). */
export const STAMP_WIDTH_FRAC = 0.17;
export const STAMP_HEIGHT_FRAC = 0.12;

/** Signature ≈ 24% × 4.5% of page. */
export const SIGNATURE_WIDTH_FRAC = 0.24;
export const SIGNATURE_HEIGHT_FRAC = 0.045;

export function pageDimensions(): { widthPt: number; heightPt: number } {
  return { widthPt: A4_WIDTH_PT, heightPt: A4_HEIGHT_PT };
}

export interface PdfStampBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function normalizeOverlayRotation(
  deg: number | undefined,
  fallback: OverlayRotation = 0,
): OverlayRotation {
  const n = Math.round(Number(deg) || 0) % 360;
  const fixed = n < 0 ? n + 360 : n;
  return (OVERLAY_ROTATIONS as readonly number[]).includes(fixed)
    ? (fixed as OverlayRotation)
    : fallback;
}

/** MDH attachment defaults to 180° unless user chose another. */
export function resolveOverlayRotation(
  options: DocumentStampOptions,
  mdhAttachment = false,
): OverlayRotation {
  if (mdhAttachment) {
    return normalizeOverlayRotation(options.overlayRotationAttachment, 180);
  }
  return normalizeOverlayRotation(options.overlayRotation, 0);
}

export function defaultStampSize(pageW: number, pageH: number): { width: number; height: number } {
  const width = pageW * STAMP_WIDTH_FRAC;
  const height = Math.max(pageH * STAMP_HEIGHT_FRAC, width * 0.85);
  return { width, height };
}

export function defaultSignatureSize(pageW: number, pageH: number): { width: number; height: number } {
  return {
    width: pageW * SIGNATURE_WIDTH_FRAC,
    height: pageH * SIGNATURE_HEIGHT_FRAC,
  };
}

export function defaultCornerStampBox(pageW: number, pageH: number): PdfStampBox {
  const { width, height } = defaultStampSize(pageW, pageH);
  const mx = pageW * 0.03;
  const my = pageH * 0.03;
  return { x: pageW - mx - width, y: my, width, height };
}

export function boxCenter(box: PdfStampBox): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export function nudgeStampBox(
  box: PdfStampBox,
  dx: number,
  dy: number,
  pageW = A4_WIDTH_PT,
  pageH = A4_HEIGHT_PT,
): PdfStampBox {
  return clampStampBox({ ...box, x: box.x + dx, y: box.y + dy }, pageW, pageH);
}

export function defaultSignatureBoxFromStamp(stamp: PdfStampBox, pageH: number): PdfStampBox {
  return signatureBoxFromStampAnchor(stamp, pageH);
}

/** Signature sits just above the stamp anchor (same area as PDF draw). */
export function signatureBoxFromStampAnchor(stamp: PdfStampBox, pageH: number): PdfStampBox {
  const { width: sigW, height: sigH } = {
    width: stamp.width * 1.05,
    height: Math.max(pageH * SIGNATURE_HEIGHT_FRAC, stamp.height * 0.42),
  };
  return {
    x: stamp.x + (stamp.width - sigW) / 2,
    y: stamp.y + stamp.height * 0.08,
    width: sigW,
    height: sigH,
  };
}

export function resolveSignatureBoxRef(
  options: DocumentStampOptions,
  stampRef: PdfStampBox,
  pageH: number,
  mdhAttachment = false,
): PdfStampBox {
  const custom = mdhAttachment ? options.signatureBoxAttachment : options.signatureBox;
  return custom ?? signatureBoxFromStampAnchor(stampRef, pageH);
}

export function defaultStampBoxForDocument(
  documentId: DocumentOverlayId,
  _mdhPage: 'form' | 'attachment' = 'form',
): PdfStampBox {
  const { widthPt, heightPt } = pageDimensions();
  if (documentId === 'portOfCall' || documentId === 'portsOfCall') {
    const poc = pocStampBoxPdfLib(widthPt, heightPt);
    const scale = 0.72;
    return {
      x: poc.x,
      y: poc.y,
      width: poc.width * scale,
      height: poc.height * scale,
    };
  }
  return defaultCornerStampBox(widthPt, heightPt);
}

export function scaleStampBoxToPage(
  box: PdfStampBox,
  pageW: number,
  pageH: number,
  refW = A4_WIDTH_PT,
  refH = A4_HEIGHT_PT,
): PdfStampBox {
  const sx = pageW / refW;
  const sy = pageH / refH;
  return {
    x: box.x * sx,
    y: box.y * sy,
    width: box.width * sx,
    height: box.height * sy,
  };
}

/** Inverse of {@link scaleStampBoxToPage} — page coords → stored A4 reference. */
export function stampBoxToRefCoordinates(
  box: PdfStampBox,
  pageW: number,
  pageH: number,
  refW = A4_WIDTH_PT,
  refH = A4_HEIGHT_PT,
): PdfStampBox {
  const sx = refW / pageW;
  const sy = refH / pageH;
  return {
    x: box.x * sx,
    y: box.y * sy,
    width: box.width * sx,
    height: box.height * sy,
  };
}

export type StampResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const STAMP_RESIZE_HANDLES: readonly StampResizeHandle[] = [
  'nw',
  'n',
  'ne',
  'w',
  'e',
  'sw',
  's',
  'se',
];

function isCornerResizeHandle(handle: StampResizeHandle): boolean {
  return handle.length === 2;
}

/** Corner drag — keep aspect ratio; opposite corner stays fixed. */
function resizeStampBoxCorner(
  box: PdfStampBox,
  handle: StampResizeHandle,
  dx: number,
  dy: number,
): PdfStampBox {
  const { x, y, width, height } = box;
  if (width <= 0 || height <= 0) {
    return box;
  }

  let proposedW = width;
  let proposedH = height;
  if (handle.includes('e')) proposedW += dx;
  if (handle.includes('w')) proposedW -= dx;
  if (handle.includes('n')) proposedH += dy;
  if (handle.includes('s')) proposedH -= dy;

  const scaleW = proposedW / width;
  const scaleH = proposedH / height;
  const scale =
    Math.abs(scaleW - 1) >= Math.abs(scaleH - 1) ? scaleW : scaleH;

  let newWidth = width * scale;
  let newHeight = height * scale;
  let newX = x;
  let newY = y;

  if (handle.includes('w')) {
    newX = x + width - newWidth;
  }
  if (handle.includes('s')) {
    newY = y + height - newHeight;
  }

  if (newWidth < 0) {
    newX += newWidth;
    newWidth = -newWidth;
  }
  if (newHeight < 0) {
    newY += newHeight;
    newHeight = -newHeight;
  }

  return { x: newX, y: newY, width: newWidth, height: newHeight };
}

/** Resize in pdf-lib space (origin bottom-left). dx/dy from pointer delta. */
export function resizeStampBox(
  box: PdfStampBox,
  handle: StampResizeHandle,
  dx: number,
  dy: number,
  pageW = A4_WIDTH_PT,
  pageH = A4_HEIGHT_PT,
): PdfStampBox {
  if (isCornerResizeHandle(handle)) {
    return clampStampBox(resizeStampBoxCorner(box, handle, dx, dy), pageW, pageH);
  }

  let { x, y, width, height } = box;

  if (handle.includes('e')) width += dx;
  if (handle.includes('w')) {
    x += dx;
    width -= dx;
  }
  if (handle.includes('n')) height += dy;
  if (handle.includes('s')) {
    y += dy;
    height -= dy;
  }

  if (width < 0) {
    x += width;
    width = -width;
  }
  if (height < 0) {
    y += height;
    height = -height;
  }

  return clampStampBox({ x, y, width, height }, pageW, pageH);
}

export function clampStampBox(
  box: PdfStampBox,
  pageW = A4_WIDTH_PT,
  pageH = A4_HEIGHT_PT,
): PdfStampBox {
  const minW = pageW * 0.06;
  const minH = pageH * 0.025;
  const w = Math.max(minW, Math.min(box.width, pageW));
  const h = Math.max(minH, Math.min(box.height, pageH));
  const x = Math.max(0, Math.min(box.x, pageW - w));
  const y = Math.max(0, Math.min(box.y, pageH - h));
  return { x, y, width: w, height: h };
}

/** Inner rect matching image aspect ratio (same fit as pdf-lib drawAsset). */
export function fittedAssetRectInBox(box: PdfStampBox, aspectRatio: number): PdfStampBox {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return { ...box };
  }
  const boxAspect = box.width / box.height;
  let w = box.width;
  let h = box.height;
  if (aspectRatio > boxAspect) {
    h = box.width / aspectRatio;
  } else if (aspectRatio < boxAspect) {
    w = box.height * aspectRatio;
  }
  return {
    x: box.x + (box.width - w) / 2,
    y: box.y + (box.height - h) / 2,
    width: w,
    height: h,
  };
}

export function stampBoxCenteredOn(
  pdfX: number,
  pdfY: number,
  size: Pick<PdfStampBox, 'width' | 'height'>,
  pageW = A4_WIDTH_PT,
  pageH = A4_HEIGHT_PT,
): PdfStampBox {
  return clampStampBox(
    {
      x: pdfX - size.width / 2,
      y: pdfY - size.height / 2,
      width: size.width,
      height: size.height,
    },
    pageW,
    pageH,
  );
}

export function stampBoxToPreviewPercents(
  box: PdfStampBox,
  pageW = A4_WIDTH_PT,
  pageH = A4_HEIGHT_PT,
): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  return {
    left: `${(box.x / pageW) * 100}%`,
    top: `${((pageH - box.y - box.height) / pageH) * 100}%`,
    width: `${(box.width / pageW) * 100}%`,
    height: `${(box.height / pageH) * 100}%`,
  };
}

export function previewClickToPdfPoint(
  offsetX: number,
  offsetY: number,
  elementWidth: number,
  elementHeight: number,
  pageW = A4_WIDTH_PT,
  pageH = A4_HEIGHT_PT,
): { x: number; y: number } {
  const relX = offsetX / elementWidth;
  const relY = offsetY / elementHeight;
  return {
    x: relX * pageW,
    y: (1 - relY) * pageH,
  };
}

export function isValidStampBox(raw: unknown): raw is PdfStampBox {
  if (!raw || typeof raw !== 'object') return false;
  const b = raw as PdfStampBox;
  return (
    typeof b.x === 'number' &&
    typeof b.y === 'number' &&
    typeof b.width === 'number' &&
    typeof b.height === 'number' &&
    b.width > 0 &&
    b.height > 0
  );
}
