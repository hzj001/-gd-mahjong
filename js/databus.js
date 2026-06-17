import ApiClient from './network/ApiClient';
import env from './config/env';

let instance;

/**
 * 全局会话状态 — 场景、用户、对局快照
 */
export default class DataBus {
  constructor() {
    if (instance) return instance;
    instance = this;
    this.api = new ApiClient({
      useMock: env.useMock,
      apiBase: env.apiBase,
      wsUrl: env.wsUrl,
    });
    this.scene = 'lobby';
    this.user = null;
    this.snapshot = null;
    this.frame = 0;
    this.loginError = false;
  }

  async init() {
    try {
      const res = await this.api.login();
      if (res.code === 0) {
        this.user = res.data;
        this.loginError = false;
      } else {
        this.loginError = true;
        wx.showToast({ title: res.message || '登录失败', icon: 'none' });
      }
    } catch (e) {
      this.loginError = true;
      wx.showToast({ title: '登录失败', icon: 'none' });
    }
  }
}
