GameGlobal.canvas = wx.createCanvas();

/** 更新画布尺寸与横屏布局信息 */
export function updateScreen() {
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  let w = info.windowWidth || info.screenWidth;
  let h = info.windowHeight || info.screenHeight;

  if (w < h) {
    [w, h] = [h, w];
  }

  canvas.width = w;
  canvas.height = h;

  GameGlobal.layout = {
    width: w,
    height: h,
    dpr: info.pixelRatio || 1,
    landscape: true,
    safeTop: info.safeArea?.top || 0,
    safeLeft: info.safeArea?.left || 0,
  };

  return GameGlobal.layout;
}

updateScreen();

if (typeof wx.onWindowResize === 'function') {
  wx.onWindowResize(() => {
    updateScreen();
    GameGlobal.main?.onResize?.();
  });
}

if (typeof wx.setDeviceOrientation === 'function') {
  try {
    wx.setDeviceOrientation({ value: 'landscape' });
  } catch (e) {
    /* 部分基础库不支持 */
  }
}
