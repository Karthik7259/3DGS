import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ExtSplats, SplatMesh, dyno } from '@sparkjsdev/spark';
import { Color, Quaternion, Vector3 } from 'three';
import { RankedSplats } from '../src/RankedSplats.ts';

test('ranked lookup shares geometry and degree-3 SH for noncontiguous original rows', () => {
  const count = 4096;
  const block = () => new Uint32Array(count * 4);
  const source = new ExtSplats({
    extArrays: [block(), block()], numSplats: count,
    extra: { sh1: block(), sh2: block(), sh3a: block(), sh3b: block() },
  });
  for (const id of [0, 2048, 4095]) {
    source.setSplat(id, new Vector3(id, -1, 2), new Vector3(1, 2, 1), new Quaternion(), 0.8, new Color(1, 0, 0));
  }
  const ids = Uint32Array.from({ length: 2049 }, (_, i) => i === 2048 ? 0 : 4095 - i);
  const ranked = new RankedSplats(source, ids);
  const mesh = new SplatMesh({ splats: ranked, enableLod: false });
  assert.equal(mesh.numSplats, ids.length);
  assert.equal(ranked.getNumSh(), 3);
  assert.deepEqual(ranked.originalIds, ids);
  ranked.forEachSplat((index, center) => {
    if ([0, 2047, 2048].includes(index)) assert.equal(center.x, ids[index]);
  });

  const graph = dyno.dynoBlock({ index: 'int', origin: 'vec3' }, { splat: dyno.Gsplat },
    ({ index, origin }) => ({ splat: ranked.fetchSplat({ index, viewOrigin: origin }) }));
  const compiled = new dyno.DynoProgram({
    graph, inputs: { index: 'renderIndex', origin: 'eye' }, outputs: { splat: 'outSplat' },
    template: new dyno.DynoProgramTemplate('{{ GLOBALS }}\nvoid main() {\n  {{ STATEMENTS }}\n}'),
  });
  assert.match(compiled.shader, /texelFetch\(selectedRows\w*, ivec2\(/);
  assert.match(compiled.shader, /evaluateExtSH3/);
  const lookup = Object.entries(compiled.uniforms).find(([key]) => key.startsWith('selectedRows'))[1].value;
  assert.equal(lookup.internalFormat, 'R32UI');
  assert.equal(lookup.image.width, 2048);
  assert.equal(lookup.image.height, 2);
  assert.equal(lookup.image.data.buffer, ranked.originalIds.buffer);
  assert.deepEqual(lookup.image.data.subarray(0, ids.length), ids);
  for (const key of ['sh1Texture', 'sh2Texture', 'sh3TextureA', 'sh3TextureB']) {
    assert.ok(Object.values(compiled.uniforms).some(uniform => uniform.value === source.extra[key].value));
  }
  assert.throws(() => new RankedSplats(source, Uint32Array.of(0, 0)), /repeated/);
  assert.throws(() => new RankedSplats(source, Uint32Array.of(count)), /Invalid/);
  mesh.dispose();
  assert.equal(source.getNumSh(), 3);
  assert.equal(source.getSplat(4095).center.x, 4095);
  source.dispose();
});
