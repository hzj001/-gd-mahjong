package game

import (
	"math/rand"
	"sync"
	"time"
)

const (
	PhaseIdle     = "idle"
	PhasePlaying  = "playing"
	PhaseReaction = "reaction"
	PhaseSettle   = "settle"
)

type Meld struct {
	Type  string   `json:"type"`
	Tiles []string `json:"tiles"`
	From  int      `json:"from,omitempty"`
}

type PlayerState struct {
	UserID   uint64   `json:"userId"`
	Name     string   `json:"name"`
	Seat     int      `json:"seat"`
	IsBot    bool     `json:"isBot"`
	Score    int      `json:"score"`
	Hand     []string `json:"-"`
	HandCnt  int      `json:"handCount"`
	Melds    []Meld   `json:"melds"`
	Discards []string `json:"discards"`
}

type Snapshot struct {
	Phase             string        `json:"phase"`
	Dealer            int           `json:"dealer"`
	Current           int           `json:"current"`
	WallRemaining     int           `json:"wallRemaining"`
	GhostTile         string        `json:"ghostTile,omitempty"`
	LastDiscard       string        `json:"lastDiscard,omitempty"`
	LastDiscardPlayer int           `json:"lastDiscardPlayer"`
	Paused            bool          `json:"paused"`
	Players           []PlayerView  `json:"players"`
	HumanSeat         int           `json:"humanSeat"`
	Round             int           `json:"round"`
}

type PlayerView struct {
	ID        uint64 `json:"id"`
	Name      string `json:"name"`
	Seat      int    `json:"seat"`
	IsHuman   bool   `json:"isHuman"`
	Score     int    `json:"score"`
	HandCount int    `json:"handCount"`
	Hand      []string `json:"hand,omitempty"`
	Melds     []Meld `json:"melds"`
	Discards  []string `json:"discards"`
}

type SettlePayload struct {
	Winner   int      `json:"winner"`
	IsZimo   bool     `json:"isZimo"`
	WinTile  string   `json:"winTile"`
	Fans     []FanDef `json:"fans"`
	TotalFan int      `json:"totalFan"`
	Score    int      `json:"score"`
}

type RuleConfig struct {
	RuleID     string
	BaseScore  int
	GhostCount int
	MaxFan     int
}

type Engine struct {
	mu sync.RWMutex

	Rule       RuleConfig
	Phase      string
	Players    []*PlayerState
	Dealer     int
	Current    int
	HumanSeat  map[uint64]int // userID -> seat for per-client view
	Wall       []string
	WallIdx    int
	GhostTile  string
	Discards   [][]string
	Melds      [][]Meld
	LastDiscard string
	LastDiscardPlayer int
	ReactionQueue []int
	Round      int
	Paused     bool
	aiTimers   []*time.Timer
	OnEvent    func(userID uint64, eventType string, payload interface{})
	OnBroadcast func(eventType string, payload interface{})
	OnSettle   func(payload SettlePayload, round int, players []*PlayerState)
}

func NewEngine(rule RuleConfig) *Engine {
	return &Engine{
		Rule:      rule,
		Phase:     PhaseIdle,
		HumanSeat: map[uint64]int{},
	}
}

func (e *Engine) InitPlayers(players []*PlayerState) {
	e.Players = players
	for _, p := range players {
		if !p.IsBot {
			e.HumanSeat[p.UserID] = p.Seat
		}
	}
}

func (e *Engine) StartRound() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.clearAITimers()
	e.Round++
	e.Phase = PhasePlaying
	e.Wall = BuildWall()
	ShuffleWall(e.Wall, NowSeed()+int64(e.Round))
	e.WallIdx = 0
	e.Discards = make([][]string, len(e.Players))
	e.Melds = make([][]Meld, len(e.Players))
	e.LastDiscard = ""
	e.LastDiscardPlayer = -1
	e.ReactionQueue = nil
	e.Paused = false

	for _, p := range e.Players {
		p.Hand = nil
		p.Melds = nil
		p.Discards = nil
	}
	for r := 0; r < 3; r++ {
		for i := range e.Players {
			for k := 0; k < 4; k++ {
				e.Players[i].Hand = append(e.Players[i].Hand, e.drawRaw())
			}
		}
	}
	for i := range e.Players {
		e.Players[i].Hand = append(e.Players[i].Hand, e.drawRaw())
	}
	e.Players[e.Dealer].Hand = append(e.Players[e.Dealer].Hand, e.drawRaw())

	if e.Rule.GhostCount > 0 {
		e.GhostTile = e.drawRaw()
	}
	for _, p := range e.Players {
		p.Hand = e.applyGhost(p.Hand)
		p.HandCnt = len(p.Hand)
	}

	e.Current = e.Dealer
	e.broadcast("game_start", map[string]interface{}{"dealer": e.Dealer, "round": e.Round})
	e.emitDeal()
	e.notifyTurn()
	e.scheduleAI(600 * time.Millisecond)
}

func (e *Engine) drawRaw() string {
	if e.WallIdx >= len(e.Wall) {
		return ""
	}
	t := e.Wall[e.WallIdx]
	e.WallIdx++
	return t
}

func (e *Engine) applyGhost(hand []string) []string {
	out := make([]string, len(hand))
	for i, t := range hand {
		if t == e.GhostTile {
			out[i] = "ghost"
		} else {
			out[i] = t
		}
	}
	return SortTiles(out)
}

func (e *Engine) SnapshotFor(userID uint64) Snapshot {
	e.mu.RLock()
	defer e.mu.RUnlock()
	humanSeat := -1
	if s, ok := e.HumanSeat[userID]; ok {
		humanSeat = s
	}
	views := make([]PlayerView, len(e.Players))
	for i, p := range e.Players {
		v := PlayerView{
			ID: p.UserID, Name: p.Name, Seat: p.Seat,
			IsHuman: !p.IsBot, Score: p.Score,
			HandCount: len(p.Hand),
			Melds: e.Melds[i], Discards: e.Discards[i],
		}
		if i == humanSeat {
			v.Hand = append([]string{}, p.Hand...)
		}
		views[i] = v
	}
	return Snapshot{
		Phase: e.Phase, Dealer: e.Dealer, Current: e.Current,
		WallRemaining: len(e.Wall) - e.WallIdx, GhostTile: e.GhostTile,
		LastDiscard: e.LastDiscard, LastDiscardPlayer: e.LastDiscardPlayer,
		Paused: e.Paused, Players: views, HumanSeat: humanSeat, Round: e.Round,
	}
}

func (e *Engine) Pause() {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.Paused || e.Phase == PhaseIdle || e.Phase == PhaseSettle {
		return
	}
	e.Paused = true
	e.clearAITimers()
	e.broadcast("game_pause", nil)
}

func (e *Engine) Resume() {
	e.mu.Lock()
	defer e.mu.Unlock()
	if !e.Paused {
		return
	}
	e.Paused = false
	e.broadcast("game_resume", nil)
	if e.Phase == PhaseReaction {
		go e.continueReaction()
	} else if e.Phase == PhasePlaying && e.Current != e.firstHumanSeat() {
		e.scheduleAILocked(400 * time.Millisecond)
	}
}

func (e *Engine) TogglePause() bool {
	if e.Paused {
		e.Resume()
	} else {
		e.Pause()
	}
	return e.Paused
}

func (e *Engine) Action(userID uint64, action, tile string) (ok bool, reason string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.Paused {
		return false, "游戏已暂停"
	}
	seat := e.seatOf(userID)
	if seat < 0 {
		return false, "不在对局中"
	}
	switch action {
	case "draw":
		return e.humanDraw(seat)
	case "discard":
		return e.discard(seat, tile)
	case "win":
		if e.Phase == PhasePlaying && e.Current == seat && e.mustDiscard(seat) {
			return e.humanZimo(seat)
		}
		return e.humanReaction(seat, action, tile)
	case "peng", "gang", "pass":
		return e.humanReaction(seat, action, tile)
	case "pause":
		e.Paused = true
		e.clearAITimers()
		e.broadcast("game_pause", nil)
		return true, ""
	case "resume":
		e.Paused = false
		e.broadcast("game_resume", nil)
		if e.Phase == PhaseReaction {
			go e.continueReaction()
		} else {
			e.scheduleAILocked(400 * time.Millisecond)
		}
		return true, ""
	default:
		return false, "未知操作"
	}
}

func (e *Engine) humanDraw(seat int) (bool, string) {
	if e.Phase != PhasePlaying || e.Current != seat {
		return false, "未轮到您"
	}
	if e.mustDiscard(seat) {
		return false, "请先出牌"
	}
	t := e.drawRaw()
	if t == "" {
		e.doDrawGame()
		return true, ""
	}
	display := t
	if t == e.GhostTile {
		display = "ghost"
	}
	e.Players[seat].Hand = SortTiles(append(e.Players[seat].Hand, display))
	e.Players[seat].HandCnt = len(e.Players[seat].Hand)
	e.broadcast("draw", map[string]interface{}{"player": seat, "tile": display})
	e.emitSync()
	return true, ""
}

func (e *Engine) humanZimo(seat int) (bool, string) {
	if !CanWin(e.Players[seat].Hand, e.Melds[seat], e.GhostTile).OK {
		return false, "不能胡"
	}
	winTile := e.GhostTile
	if len(e.Players[seat].Hand) > 0 {
		last := e.Players[seat].Hand[len(e.Players[seat].Hand)-1]
		if last != "ghost" {
			winTile = last
		}
	}
	e.doWin(seat, true, winTile)
	return true, ""
}

func (e *Engine) discard(seat int, tile string) (bool, string) {
	if e.Phase != PhasePlaying || e.Current != seat {
		return false, "未轮到您"
	}
	if !e.mustDiscard(seat) {
		return false, "请先摸牌"
	}
	p := e.Players[seat]
	idx := indexOf(p.Hand, tile)
	if idx < 0 {
		return false, "无此牌"
	}
	p.Hand = append(p.Hand[:idx], p.Hand[idx+1:]...)
	p.HandCnt = len(p.Hand)
	raw := tile
	if tile == "ghost" {
		raw = e.GhostTile
	}
	e.Discards[seat] = append(e.Discards[seat], raw)
	e.LastDiscard = raw
	e.LastDiscardPlayer = seat
	e.broadcast("discard", map[string]interface{}{"player": seat, "tile": raw})
	e.beginReaction(seat)
	return true, ""
}

func (e *Engine) beginReaction(fromSeat int) {
	e.Phase = PhaseReaction
	e.ReactionQueue = []int{}
	for i := range e.Players {
		if i != fromSeat {
			e.ReactionQueue = append(e.ReactionQueue, i)
		}
	}
	// 避免在 Action 持锁时同步进入 continueReaction 导致死锁
	go e.continueReaction()
}

func (e *Engine) continueReaction() {
	e.mu.Lock()
	if e.Paused || e.Phase != PhaseReaction {
		e.mu.Unlock()
		return
	}
	if len(e.ReactionQueue) == 0 {
		e.Phase = PhasePlaying
		e.Current = (e.LastDiscardPlayer + 1) % len(e.Players)
		e.notifyTurnLocked()
		e.emitSyncLocked()
		e.scheduleAILocked(500 * time.Millisecond)
		e.mu.Unlock()
		return
	}
	seat := e.ReactionQueue[0]
	p := e.Players[seat]
	if !p.IsBot {
		opts := e.availableReactLocked(seat)
		e.broadcast("action_request", map[string]interface{}{
			"player": seat, "options": opts, "tile": e.LastDiscard,
		})
		e.mu.Unlock()
		return
	}
	tile := e.LastDiscard
	opts := e.availableReactLocked(seat)
	act := chooseBotReaction(p.Hand, tile, e.Melds[seat], opts)
	if act == "pass" {
		e.ReactionQueue = e.ReactionQueue[1:]
		e.mu.Unlock()
		e.continueReaction()
		return
	}
	e.mu.Unlock()
	e.Action(p.UserID, act, tile)
}

func (e *Engine) humanReaction(seat int, action, tile string) (bool, string) {
	if e.Phase != PhaseReaction {
		return false, "当前不可反应"
	}
	if len(e.ReactionQueue) == 0 || e.ReactionQueue[0] != seat {
		return false, "请等待"
	}
	if action == "pass" {
		e.ReactionQueue = e.ReactionQueue[1:]
		go e.continueReaction()
		return true, ""
	}
	if action == "win" {
		if !CanWinWithTile(e.Players[seat].Hand, tile, e.Melds[seat], e.GhostTile) {
			return false, "不能胡"
		}
		e.doWin(seat, false, tile)
		return true, ""
	}
	if action == "peng" {
		if !CanPeng(e.Players[seat].Hand, tile) {
			return false, "不能碰"
		}
		e.removeFromHand(seat, tile, 2)
		e.Melds[seat] = append(e.Melds[seat], Meld{Type: "peng", Tiles: []string{tile, tile, tile}, From: e.LastDiscardPlayer})
		e.Discards[e.LastDiscardPlayer] = e.Discards[e.LastDiscardPlayer][:len(e.Discards[e.LastDiscardPlayer])-1]
		e.LastDiscard = ""
		e.Current = seat
		e.Phase = PhasePlaying
		e.ReactionQueue = nil
		e.emitSyncLocked()
		e.scheduleAILocked(500 * time.Millisecond)
		return true, ""
	}
	if action == "gang" {
		if !CanGang(e.Players[seat].Hand, tile) {
			return false, "不能杠"
		}
		e.removeFromHand(seat, tile, 3)
		e.Melds[seat] = append(e.Melds[seat], Meld{Type: "ming", Tiles: []string{tile, tile, tile, tile}, From: e.LastDiscardPlayer})
		e.Discards[e.LastDiscardPlayer] = e.Discards[e.LastDiscardPlayer][:len(e.Discards[e.LastDiscardPlayer])-1]
		e.Current = seat
		e.Phase = PhasePlaying
		e.ReactionQueue = nil
		d := e.drawRaw()
		if d != "" {
			display := d
			if d == e.GhostTile {
				display = "ghost"
			}
			e.Players[seat].Hand = SortTiles(append(e.Players[seat].Hand, display))
		}
		e.emitSyncLocked()
		e.scheduleAILocked(500 * time.Millisecond)
		return true, ""
	}
	return false, "无效操作"
}

func (e *Engine) doWin(seat int, isZimo bool, winTile string) {
	e.Phase = PhaseSettle
	hand := append([]string{}, e.Players[seat].Hand...)
	if !isZimo && winTile != "" {
		display := winTile
		if winTile == e.GhostTile {
			display = "ghost"
		}
		hand = append(hand, display)
	}
	fan := CalcFan(hand, e.Melds[seat], isZimo, e.Rule.GhostCount > 0)
	score := e.Rule.BaseScore * fan.TotalFan
	if score < 1 {
		score = 1
	}
	e.Players[seat].Score += score
	if !isZimo && e.LastDiscardPlayer >= 0 {
		e.Players[e.LastDiscardPlayer].Score -= score
	} else {
		share := score / 3
		for i := range e.Players {
			if i != seat {
				e.Players[i].Score -= share
			}
		}
	}
	settle := SettlePayload{
		Winner: seat, IsZimo: isZimo, WinTile: winTile,
		Fans: fan.Fans, TotalFan: fan.TotalFan, Score: score,
	}
	e.broadcast("settle", settle)
	if e.OnSettle != nil {
		pcopy := make([]*PlayerState, len(e.Players))
		for i, p := range e.Players {
			cp := *p
			pcopy[i] = &cp
		}
		cb := e.OnSettle
		rnd := e.Round
		go cb(settle, rnd, pcopy)
	}
	e.emitSyncLocked()
}

func (e *Engine) doDrawGame() {
	e.Phase = PhaseSettle
	e.broadcast("round_end", map[string]interface{}{"draw": true})
}

func (e *Engine) mustDiscard(seat int) bool {
	return len(e.Players[seat].Hand)%3 == 2
}

func (e *Engine) removeFromHand(seat int, tile string, n int) {
	p := e.Players[seat]
	left := n
	for i := len(p.Hand) - 1; i >= 0 && left > 0; i-- {
		t := p.Hand[i]
		if t == tile || (t == "ghost" && tile == e.GhostTile) {
			p.Hand = append(p.Hand[:i], p.Hand[i+1:]...)
			left--
		}
	}
	p.HandCnt = len(p.Hand)
}

func (e *Engine) availableReactLocked(seat int) []string {
	opts := []string{}
	tile := e.LastDiscard
	hand := e.Players[seat].Hand
	melds := e.Melds[seat]
	if CanWinWithTile(hand, tile, melds, e.GhostTile) {
		opts = append(opts, "win")
	}
	if CanGang(hand, tile) {
		opts = append(opts, "gang")
	}
	if CanPeng(hand, tile) {
		opts = append(opts, "peng")
	}
	opts = append(opts, "pass")
	return opts
}

func (e *Engine) seatOf(userID uint64) int {
	for _, p := range e.Players {
		if p.UserID == userID {
			return p.Seat
		}
	}
	return -1
}

func (e *Engine) firstHumanSeat() int {
	for _, p := range e.Players {
		if !p.IsBot {
			return p.Seat
		}
	}
	return 0
}

func (e *Engine) scheduleAI(d time.Duration) {
	e.mu.Lock()
	e.scheduleAILocked(d)
	e.mu.Unlock()
}

func (e *Engine) scheduleAILocked(d time.Duration) {
	if e.Paused || e.Phase == PhaseSettle {
		return
	}
	seat := e.Current
	if seat < 0 || seat >= len(e.Players) {
		return
	}
	if e.Players[seat].IsBot {
		t := time.AfterFunc(d, func() { e.aiTurn(seat) })
		e.aiTimers = append(e.aiTimers, t)
	}
}

func (e *Engine) aiTurn(seat int) {
	e.mu.Lock()
	if e.Paused || e.Phase == PhaseSettle || e.Current != seat || e.Players[seat].IsBot == false {
		e.mu.Unlock()
		return
	}
	if e.Phase == PhasePlaying {
		if !e.mustDiscard(seat) {
			t := e.drawRaw()
			if t == "" {
				e.doDrawGame()
				e.mu.Unlock()
				return
			}
			display := t
			if t == e.GhostTile {
				display = "ghost"
			}
			e.Players[seat].Hand = SortTiles(append(e.Players[seat].Hand, display))
			e.Players[seat].HandCnt = len(e.Players[seat].Hand)
			e.broadcast("draw", map[string]interface{}{"player": seat, "tile": nil})
			e.emitSyncLocked()
		}
		tile := chooseBotDiscard(e.Players[seat].Hand, e.Melds[seat])
		e.mu.Unlock()
		e.Action(e.Players[seat].UserID, "discard", tile)
		return
	}
	e.mu.Unlock()
}

func (e *Engine) clearAITimers() {
	for _, t := range e.aiTimers {
		t.Stop()
	}
	e.aiTimers = nil
}

func (e *Engine) Reset() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.clearAITimers()
	e.Phase = PhaseIdle
	e.Paused = false
}

func (e *Engine) emitDeal() {
	for uid := range e.HumanSeat {
		snap := e.SnapshotFor(uid)
		hand := []string{}
		if snap.HumanSeat >= 0 && snap.HumanSeat < len(snap.Players) {
			hand = snap.Players[snap.HumanSeat].Hand
		}
		if e.OnEvent != nil {
			e.OnEvent(uid, "deal", map[string]interface{}{
				"type": "deal", "hand": hand, "dealer": e.Dealer, "ghostTile": e.GhostTile,
			})
		}
	}
}

func (e *Engine) notifyTurn() {
	e.mu.RLock()
	e.notifyTurnLocked()
	e.mu.RUnlock()
}

func (e *Engine) notifyTurnLocked() {
	e.broadcast("turn", map[string]interface{}{
		"type": "turn", "player": e.Current, "mustDiscard": e.mustDiscard(e.Current),
	})
}

func (e *Engine) emitSync() {
	e.mu.RLock()
	e.emitSyncLocked()
	e.mu.RUnlock()
}

func (e *Engine) emitSyncLocked() {
	if e.OnBroadcast == nil {
		return
	}
	e.OnBroadcast("sync", nil)
}

func (e *Engine) broadcast(eventType string, payload interface{}) {
	if e.OnBroadcast != nil {
		e.OnBroadcast(eventType, payload)
	}
}

func indexOf(arr []string, v string) int {
	for i, x := range arr {
		if x == v {
			return i
		}
	}
	return -1
}

func chooseBotReaction(hand []string, tile string, melds []Meld, opts []string) string {
	has := func(k string) bool {
		for _, o := range opts {
			if o == k {
				return true
			}
		}
		return false
	}
	if has("win") && rand.Float32() > 0.2 {
		return "win"
	}
	if has("gang") && rand.Float32() > 0.6 {
		return "gang"
	}
	if has("peng") && rand.Float32() > 0.5 {
		return "peng"
	}
	return "pass"
}

func chooseBotDiscard(hand []string, melds []Meld) string {
	if len(hand) == 0 {
		return ""
	}
	sorted := SortTiles(hand)
	if CanWin(sorted, melds, "").OK {
		return sorted[len(sorted)-1]
	}
	return sorted[0]
}
