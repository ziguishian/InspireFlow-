/**
 * Minimal ZIP parser for extracting .glb files (no external deps).
 * Supports stored (0) and deflate (8) compression.
 */

const EOCDR_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

const COMPRESSION_STORED = 0;
const COMPRESSION_DEFLATE = 8;

function readU32(view: DataView, off: number): number {
  return view.getUint32(off, true);
}
function readU16(view: DataView, off: number): number {
  return view.getUint16(off, true);
}

function findEOCDR(ab: ArrayBuffer): number {
  const view = new DataView(ab);
  const len = ab.byteLength;
  const maxComment = 65536;
  for (let i = len - 22; i >= Math.max(0, len - maxComment - 22); i -= 1) {
    if (readU32(view, i) === EOCDR_SIG) return i;
  }
  throw new Error('ZIP: End of central directory not found');
}

export interface ZipEntry {
  path: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

function parseCentralDirectory(ab: ArrayBuffer): ZipEntry[] {
  const view = new DataView(ab);
  const eocdrOff = findEOCDR(ab);
  const centralDirOffset = readU32(view, eocdrOff + 16);
  const totalEntries = readU16(view, eocdrOff + 8);
  const entries: ZipEntry[] = [];
  let off = centralDirOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (readU32(view, off) !== CENTRAL_SIG) break;
    const compressionMethod = readU16(view, off + 10);
    const compressedSize = readU32(view, off + 20);
    const uncompressedSize = readU32(view, off + 24);
    const nameLen = readU16(view, off + 28);
    const extraLen = readU16(view, off + 30);
    const commentLen = readU16(view, off + 32);
    const localHeaderOffset = readU32(view, off + 42);
    const nameBytes = new Uint8Array(ab, off + 46, nameLen);
    const path = new TextDecoder('utf-8').decode(nameBytes).replace(/\\/g, '/');
    entries.push({
      path,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function getLocalFileDataOffset(ab: ArrayBuffer, entry: ZipEntry): number {
  const view = new DataView(ab);
  const off = entry.localHeaderOffset;
  if (readU32(view, off) !== LOCAL_SIG) throw new Error('ZIP: Invalid local header');
  const nameLen = readU16(view, off + 26);
  const extraLen = readU16(view, off + 28);
  return off + 30 + nameLen + extraLen;
}

async function inflate(raw: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([raw as BlobPart]).stream();
  const DS = typeof DecompressionStream !== 'undefined' ? DecompressionStream : (globalThis as unknown as { DecompressionStream?: new (format: string) => TransformStream }).DecompressionStream;
  if (!DS) throw new Error('ZIP: DecompressionStream not supported (use a modern browser)');
  const ds = new DS('deflate-raw');
  const decompressed = await new Response(stream.pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(decompressed);
}

export async function extractZipEntryAsBlob(ab: ArrayBuffer, entry: ZipEntry): Promise<Blob> {
  const dataOff = getLocalFileDataOffset(ab, entry);
  const raw = new Uint8Array(ab, dataOff, entry.compressedSize);
  let bytes: Uint8Array;
  if (entry.compressionMethod === COMPRESSION_STORED) {
    bytes = new Uint8Array(raw);
  } else if (entry.compressionMethod === COMPRESSION_DEFLATE) {
    bytes = await inflate(raw);
  } else {
    throw new Error(`ZIP: Unsupported compression method ${entry.compressionMethod}`);
  }
  return new Blob([bytes as BlobPart], { type: 'application/octet-stream' });
}

/**
 * Parse ZIP and return only .glb entries (paths and extract info).
 */
export function listZipGlbEntries(ab: ArrayBuffer): ZipEntry[] {
  const all = parseCentralDirectory(ab);
  return all.filter((e) => /\.glb$/i.test(e.path));
}
