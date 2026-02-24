import type { LayerMap } from './layerStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProjectFile {
  layers: LayerMap;
  navStack: string[];
}

// ─── Feature detection ────────────────────────────────────────────────────────

/** Returns true if the File System Access API is available (Chrome/Edge 86+). */
export function canUseFileSystemAPI(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

// ─── Open ─────────────────────────────────────────────────────────────────────

/**
 * Open a file-picker for .json files and parse the project.
 * Returns null if the user cancels.
 */
export async function pickAndReadFile(): Promise<{
  handle: FileSystemFileHandle;
  data: ProjectFile;
} | null> {
  try {
    const [handle] = await (window as Window & typeof globalThis & {
      showOpenFilePicker: (opts?: object) => Promise<FileSystemFileHandle[]>;
    }).showOpenFilePicker({
      types: [{ description: 'Drafter Project', accept: { 'application/json': ['.json'] } }],
      multiple: false,
    });

    const file = await handle.getFile();
    const text = await file.text();
    const parsed = JSON.parse(text);

    // Accept both a bare LayerMap and a full ProjectFile ({ layers, navStack })
    const data: ProjectFile =
      parsed && typeof parsed === 'object' && 'layers' in parsed && !Array.isArray(parsed.layers)
        ? (parsed as ProjectFile)
        : { layers: parsed as LayerMap, navStack: ['root'] };

    return { handle, data };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') return null;
    throw err;
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

/** Write project data back to an existing file handle (in-place save). */
export async function writeToHandle(
  handle: FileSystemFileHandle,
  data: ProjectFile,
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

/**
 * Open a Save-As picker and write the project.
 * Returns the new handle, or null if the user cancels.
 */
export async function pickSaveAndWrite(
  data: ProjectFile,
  suggestedName = 'drafter-project.json',
): Promise<FileSystemFileHandle | null> {
  try {
    const handle = await (window as Window & typeof globalThis & {
      showSaveFilePicker: (opts?: object) => Promise<FileSystemFileHandle>;
    }).showSaveFilePicker({
      suggestedName,
      types: [{ description: 'Drafter Project', accept: { 'application/json': ['.json'] } }],
    });
    await writeToHandle(handle, data);
    return handle;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') return null;
    throw err;
  }
}

// ─── Fallback download ────────────────────────────────────────────────────────

/** Trigger a browser download of the project JSON (fallback for browsers without File API). */
export function downloadProjectFile(data: ProjectFile, filename = 'drafter-project.json'): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
