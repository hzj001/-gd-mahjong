/** 广东推倒胡默认规则包 — 与 Go 后端 rule 表字段对齐 */
export default {
  ruleId: 'gd_tuidaohu_v1',
  name: '广东推倒胡',
  tiles: 136,
  allowChi: false,
  ghostCount: 1,
  ghostFromTail: true,
  maxFan: 64,
  baseScore: 1,
  drawTimeoutSec: 15,
  horse: { enabled: true, count: 4 },
  gangScore: { ming: 1, an: 2, bu: 1 },
  winModes: ['zimo', 'dianpao'],
  multiWin: false,
};
