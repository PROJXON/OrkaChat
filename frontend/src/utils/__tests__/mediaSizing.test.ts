import { calcCappedMediaSize } from '../mediaSizing';

describe('calcCappedMediaSize', () => {
  it('caps height to maxHeight using defaults (aspect=1)', () => {
    // With defaults: frac=0.86, maxHeight=240, minMaxWidth=220, rounding=floor
    // availableWidth=1000 => maxW=max(220, floor(1000*0.86)=860)=860
    // aspect=1 => initial h=floor(860/1)=860 which exceeds 240 => cap to 240
    // then w=floor(240*1)=240
    expect(calcCappedMediaSize({ availableWidth: 1000, aspect: 1 })).toEqual({ w: 240, h: 240 });
  });

  it('caps height and recomputes width for a wide aspect (16:9)', () => {
    // maxW=860; initial h=floor(860 / (16/9))=483 => cap to 240
    // w=floor(240*(16/9))=426
    expect(calcCappedMediaSize({ availableWidth: 1000, aspect: 16 / 9 })).toEqual({
      w: 426,
      h: 240,
    });
  });

  it('uses minWWhenCapped to prevent width from becoming too small after capping', () => {
    // With a tall aspect, width after cap would be small; minWWhenCapped forces a minimum.
    // maxW=860; cap height to 240
    // w2=floor(240*(9/16))=135; minWWhenCapped=220 => w2 becomes 220; w=min(860,220)=220
    expect(
      calcCappedMediaSize({ availableWidth: 1000, aspect: 9 / 16, minWWhenCapped: 220 }),
    ).toEqual({ w: 220, h: 240 });
  });

  it('respects minHInitial (forces an initial minimum height before any capping)', () => {
    // availableWidth=300 => maxW=max(220, floor(300*0.86)=258)=258
    // aspect=2 => h=floor(258/2)=129
    // minHInitial=200 => h becomes 200 (still <= maxHeight=240 so no cap)
    expect(calcCappedMediaSize({ availableWidth: 300, aspect: 2, minHInitial: 200 })).toEqual({
      w: 258,
      h: 200,
    });
  });

  it('rounding=round changes the computed height compared to floor', () => {
    // Choose availableWidth so maxW becomes 221:
    // floor(257*0.86)=221; maxW=max(220,221)=221
    // aspect=2 => w/a = 110.5 => floor => 110, round => 111
    const floorSize = calcCappedMediaSize({ availableWidth: 257, aspect: 2, rounding: 'floor' });
    const roundSize = calcCappedMediaSize({ availableWidth: 257, aspect: 2, rounding: 'round' });

    expect(floorSize).toEqual({ w: 221, h: 110 });
    expect(roundSize).toEqual({ w: 221, h: 111 });
  });
});
