import { dyno, type ExtSplats, type SplatMeshOptions } from '@sparkjsdev/spark';
import { DataTexture, RedIntegerFormat, UnsignedIntType } from 'three';

type SplatSource = NonNullable<SplatMeshOptions['splats']>;
const TEXTURE_WIDTH = 2048;

/** A ranked view of a single immutable Graphdeco model. The lookup precedes
 * Spark's geometry, opacity, DC and directional SH reads, so all attributes
 * use exactly the same original PLY row. */
export class RankedSplats implements SplatSource {
  readonly originalIds: Uint32Array;
  private readonly source: ExtSplats;
  private readonly texture: DataTexture;
  private readonly indexUniform: ReturnType<typeof dyno.dynoUsampler2D>;

  constructor(source: ExtSplats, ids: Uint32Array) {
    const total = source.getNumSplats();
    if (!ids.length || ids.length > total) throw new Error('Invalid number of selected Gaussians.');
    const used = new Uint8Array(Math.ceil(total / 8));
    for (const id of ids) {
      const bit = 1 << (id & 7);
      if (id >= total || (used[id >>> 3] & bit)) throw new Error(`Invalid or repeated Gaussian ID ${id}.`);
      used[id >>> 3] |= bit;
    }

    const height = Math.ceil(ids.length / TEXTURE_WIDTH);
    const pixels = new Uint32Array(TEXTURE_WIDTH * height);
    pixels.set(ids);
    this.originalIds = pixels.subarray(0, ids.length);
    this.source = source;
    this.texture = new DataTexture(pixels, TEXTURE_WIDTH, height, RedIntegerFormat, UnsignedIntType);
    this.texture.internalFormat = 'R32UI';
    this.texture.needsUpdate = true;
    this.indexUniform = dyno.dynoUsampler2D(this.texture, 'selectedRows');
  }

  getNumSplats() { return this.originalIds.length; }
  getNumSh() { return this.source.getNumSh(); }
  hasRgbDir() { return this.source.hasRgbDir(); }
  setMaxSh(degree: number) { this.source.setMaxSh(degree); }
  prepareFetchSplat() { this.source.prepareFetchSplat(); }
  dispose() { this.texture.dispose(); }

  fetchSplat({ index, viewOrigin }: Parameters<SplatSource['fetchSplat']>[0]) {
    const row = dyno.dyno({
      inTypes: { index: 'int', rows: 'usampler2D' }, outTypes: { row: 'int' },
      inputs: { index, rows: this.indexUniform },
      statements: ({ inputs, outputs }) => [
        `${outputs.row} = int(texelFetch(${inputs.rows}, ivec2(${inputs.index} % ${TEXTURE_WIDTH}, ${inputs.index} / ${TEXTURE_WIDTH}), 0).r);`,
      ],
    });
    return this.source.fetchSplat({ index: row.outputs.row, viewOrigin });
  }

  forEachSplat(callback: Parameters<SplatSource['forEachSplat']>[0]) {
    this.originalIds.forEach((id, index) => {
      const { center, scales, quaternion, opacity, color } = this.source.getSplat(id);
      callback(index, center, scales, quaternion, opacity, color);
    });
  }
}
