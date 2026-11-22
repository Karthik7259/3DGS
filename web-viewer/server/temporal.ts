import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { temporalMethods, type PilotFrame, type TemporalBudget, type TemporalMethod, type TemporalPilot } from '../src/temporalData.ts';

type Entry = {
  frame: number; image_filename: string; loader_index: number; K: number;
  sha256: string; selected_set_sha256: string; shared_previous_count: number | null;
};
type Selections = { methods: Record<TemporalMethod, Record<TemporalBudget, {K: number; frames: Entry[]}>> };
type Sample = { image_filenames: string[]; loader_indices: number[]; training_only: boolean };
type CSV = Record<string, string>;

// The pilot CSVs used below contain unquoted, comma-separated values.
function rows(text: string): CSV[] {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const fields = header.split(',');
  return lines.map(line => Object.fromEntries(line.split(',').map((v, i) => [fields[i], v])));
}

function measurement(value: string | undefined) {
  if (!value?.trim() || !Number.isFinite(Number(value))) throw new Error('Missing numeric temporal measurement.');
  return Number(value);
}

export function temporalArchive(experiments: string) {
  const root = path.join(experiments, 'temporal_rendering_pilot');
  async function readIndex() {
    const [sampleText, selectionText, qualityText, stabilityText, trainingText] = await Promise.all([
      'camera_subset_manifest.json', 'selection_manifest.json', 'results/per_camera_metrics.csv',
      'results/temporal_stability_metrics.csv', '../full_scale_scalability_validation/camera_sequence.csv',
    ].map(name => readFile(path.join(root, name), 'utf8')));
    const sample: Sample = JSON.parse(sampleText);
    const selections: Selections = JSON.parse(selectionText);
    const training = rows(trainingText);
    const trainingSequence = training.map(r => r.filename);
    if (!sample.training_only || sample.image_filenames.length !== 20 || training.length !== 219 ||
      training.some((r, i) => r.is_test_view !== 'False' || Number(r.camera_index) !== i)) {
      throw new Error('The archived training camera sequence is inconsistent.');
    }
    const key = (r: CSV) => [r.method, r.budget_percent, r.frame].join('/');
    const quality = new Map(rows(qualityText).map(r => [key(r), r]));
    const stability = new Map(rows(stabilityText).map(r => [key(r), r]));
    if (quality.size !== 120 || stability.size !== 114) throw new Error('The temporal pilot measurements are incomplete.');
    const frames: PilotFrame[] = sample.image_filenames.map((image, index) => {
      const loaderIndex = sample.loader_indices[index];
      if (!/^\d{6}\.jpg$/.test(image) || trainingSequence[loaderIndex] !== image) throw new Error('Training camera join failed.');
      const results = {} as PilotFrame['results'];
      for (const method of temporalMethods) {
        results[method] = {} as PilotFrame['results'][typeof method];
        for (const budget of [5, 10] as const) {
          const rowKey = [method, budget, index].join('/');
          const metric = quality.get(rowKey);
          const transition = stability.get(rowKey);
          const entry = selections.methods[method][budget].frames[index];
          const count = Math.floor(2_050_123 * budget / 100);
          const shared = entry.shared_previous_count;
          const overlap = transition ? measurement(transition.overlap_percent) : null;
          if (!metric || metric.image_filename !== image || metric.selected_ids_sha256 !== entry.selected_set_sha256 ||
              entry.K !== count || measurement(metric.K) !== count || measurement(metric.rasterizer_gaussian_count_verified) !== count ||
              measurement(metric.training_loader_index) !== loaderIndex || entry.frame !== index ||
              entry.image_filename !== image || entry.loader_index !== loaderIndex ||
              (index === 0 && (shared !== null || transition)) ||
              (index > 0 && (transition?.to_image !== image || transition.from_image !== sample.image_filenames[index - 1] ||
                shared === null || !Number.isInteger(shared) || shared < 0 || shared > count || overlap === null ||
                measurement(transition.shared_gaussians) !== shared || Math.abs(overlap - 100 * shared / count) > 1e-8))) {
            throw new Error('Temporal experiment records disagree for ' + rowKey);
          }
          results[method][budget] = {
            count, shared, overlap, psnr: measurement(metric.PSNR_dB), ssim: measurement(metric.SSIM),
            renderFps: measurement(metric.render_call_fps),
          };
        }
      }
      return { image, loaderIndex, results };
    });
    return { pilot: { frames, trainingSequence } satisfies TemporalPilot, selections };
  }
  let cache: ReturnType<typeof readIndex> | undefined;
  const index = () => cache ??= readIndex().catch(error => { cache = undefined; throw error; });
  return {
    async manifest() { return (await index()).pilot; },
    async asset(kind: 'ids' | 'render', method: TemporalMethod, budget: TemporalBudget, frame: number) {
      const { selections } = await index();
      const row = selections.methods[method][budget].frames[frame];
      const stem = String(frame).padStart(2, '0') + '_' + row.image_filename.slice(0, -4);
      if (kind === 'render') return path.join(root, 'renders', method, budget + 'pct', stem + '.png');
      const npy = await readFile(path.join(root, 'selections', method, budget + 'pct', stem + '.npy'));
      if (createHash('sha256').update(npy).digest('hex') !== row.sha256) throw new Error('Archived temporal ID checksum mismatch.');
      if (npy.toString('latin1', 0, 6) !== '\x93NUMPY' || npy[6] !== 1) throw new Error('Unexpected temporal ID file format.');
      const offset = 10 + npy.readUInt16LE(8);
      const header = npy.toString('ascii', 10, offset);
      if (!header.includes("'descr': '<u4'") || !header.includes("'fortran_order': False") ||
          !header.includes(`'shape': (${row.K},)`) || npy.length - offset !== row.K * 4) {
        throw new Error('Temporal ID array does not match its manifest.');
      }
      return npy.subarray(offset);
    },
  };
}
