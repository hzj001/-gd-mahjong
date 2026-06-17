/** 番型表 — fanId 与 Go 后端一致 */
export default [
  { fanId: 'pinghu', name: '平胡', fan: 1, mutex: [] },
  { fanId: 'pengpeng', name: '对对胡', fan: 3, mutex: ['pinghu'] },
  { fanId: 'hunYise', name: '混一色', fan: 4, mutex: ['pinghu'] },
  { fanId: 'qingYise', name: '清一色', fan: 7, mutex: ['pinghu', 'hunYise'] },
  { fanId: 'qiDui', name: '七对', fan: 5, mutex: ['pinghu', 'pengpeng'] },
  { fanId: 'menqing', name: '门清', fan: 1, mutex: [] },
  { fanId: 'zimo', name: '自摸', fan: 1, mutex: [] },
  { fanId: 'gangShang', name: '杠上开花', fan: 2, mutex: [] },
  { fanId: 'qiangGang', name: '抢杠胡', fan: 2, mutex: [] },
  { fanId: 'wuGui', name: '无鬼', fan: 2, mutex: [] },
  { fanId: 'siGui', name: '四鬼', fan: 4, mutex: [] },
  { fanId: 'xiaoSanYuan', name: '小三元', fan: 5, mutex: [] },
  { fanId: 'daSanYuan', name: '大三元', fan: 8, mutex: ['xiaoSanYuan'] },
  { fanId: 'xiaoSiXi', name: '小四喜', fan: 6, mutex: [] },
  { fanId: 'daSiXi', name: '大四喜', fan: 10, mutex: ['xiaoSiXi'] },
  { fanId: 'shiSanYao', name: '十三幺', fan: 13, mutex: ['pinghu', 'pengpeng', 'qiDui'] },
];
