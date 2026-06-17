package auth

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"gdMahjong/server/internal/config"
)

type WxSession struct {
	OpenID     string `json:"openid"`
	SessionKey string `json:"session_key"`
	UnionID    string `json:"unionid"`
}

type WeChatAuth struct {
	cfg config.WeChatConfig
}

func NewWeChatAuth(cfg config.WeChatConfig) *WeChatAuth {
	return &WeChatAuth{cfg: cfg}
}

func (w *WeChatAuth) Code2Session(code string) (*WxSession, error) {
	if w.cfg.MockLogin || w.cfg.AppID == "" {
		return &WxSession{
			OpenID:     "mock_" + code,
			SessionKey: "mock_session",
		}, nil
	}
	u := fmt.Sprintf(
		"https://api.weixin.qq.com/sns/jscode2session?appid=%s&secret=%s&js_code=%s&grant_type=authorization_code",
		url.QueryEscape(w.cfg.AppID),
		url.QueryEscape(w.cfg.AppSecret),
		url.QueryEscape(code),
	)
	resp, err := http.Get(u)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var raw map[string]interface{}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}
	if errcode, ok := raw["errcode"].(float64); ok && errcode != 0 {
		return nil, fmt.Errorf("wechat error: %v", raw["errmsg"])
	}
	var sess WxSession
	if err := json.Unmarshal(body, &sess); err != nil {
		return nil, err
	}
	if sess.OpenID == "" {
		return nil, fmt.Errorf("empty openid")
	}
	return &sess, nil
}
