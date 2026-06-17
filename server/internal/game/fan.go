package game

type FanDef struct {
	FanID string `json:"fanId"`
	Name  string `json:"name"`
	Fan   int    `json:"fan"`
	Mutex []string
}

type FanResult struct {
	Fans     []FanDef `json:"fans"`
	TotalFan int      `json:"totalFan"`
}

var fanTable = []FanDef{
	{FanID: "pinghu", Name: "平胡", Fan: 1},
	{FanID: "pengpeng", Name: "对对胡", Fan: 3, Mutex: []string{"pinghu"}},
	{FanID: "hunYise", Name: "混一色", Fan: 4, Mutex: []string{"pinghu"}},
	{FanID: "qingYise", Name: "清一色", Fan: 7, Mutex: []string{"pinghu", "hunYise"}},
	{FanID: "qiDui", Name: "七对", Fan: 5, Mutex: []string{"pinghu", "pengpeng"}},
	{FanID: "menqing", Name: "门清", Fan: 1},
	{FanID: "zimo", Name: "自摸", Fan: 1},
	{FanID: "wuGui", Name: "无鬼", Fan: 2},
}

func CalcFan(hand []string, melds []Meld, isZimo, hasGhostRule bool) FanResult {
	win := CanWin(hand, melds, "")
	if !win.OK {
		return FanResult{}
	}
	hits := []string{}
	if win.Type == "qiDui" {
		hits = append(hits, "qiDui")
	} else {
		all := allTiles(hand, melds)
		if isQingYise(all) {
			hits = append(hits, "qingYise")
		} else if isHunYise(all) {
			hits = append(hits, "hunYise")
		} else if isPengPeng(all) {
			hits = append(hits, "pengpeng")
		} else {
			hits = append(hits, "pinghu")
		}
	}
	if isZimo {
		hits = append(hits, "zimo")
	}
	if len(melds) == 0 {
		hits = append(hits, "menqing")
	}
	_, ghosts := splitGhost(hand)
	if hasGhostRule && ghosts == 0 {
		hits = append(hits, "wuGui")
	}
	fans := resolveFans(hits)
	total := 0
	for _, f := range fans {
		total += f.Fan
	}
	if total > 64 {
		total = 64
	}
	if total < 1 {
		total = 1
	}
	return FanResult{Fans: fans, TotalFan: total}
}

func allTiles(hand []string, melds []Meld) []string {
	t := append([]string{}, hand...)
	for _, m := range melds {
		t = append(t, m.Tiles...)
	}
	out := make([]string, 0, len(t))
	for _, x := range t {
		if x != "ghost" {
			out = append(out, x)
		}
	}
	return out
}

func isQingYise(tiles []string) bool {
	suits := map[string]bool{}
	for _, t := range tiles {
		if IsHonor(t) {
			return false
		}
		suits[TileSuit(t)] = true
	}
	return len(suits) == 1
}

func isHunYise(tiles []string) bool {
	suits := map[string]bool{}
	hasHonor := false
	for _, t := range tiles {
		if IsHonor(t) {
			hasHonor = true
		} else {
			suits[TileSuit(t)] = true
		}
	}
	return len(suits) == 1 && hasHonor
}

func isPengPeng(tiles []string) bool {
	counts := countMap(tiles)
	pairs := 0
	for _, c := range counts {
		if c == 2 {
			pairs++
		} else if c != 3 && c != 4 {
			return false
		}
	}
	return pairs <= 1
}

func resolveFans(hits []string) []FanDef {
	m := map[string]FanDef{}
	for _, f := range fanTable {
		m[f.FanID] = f
	}
	selected := []FanDef{}
	used := map[string]bool{}
	// sort by fan desc
	for _, id := range hits {
		def, ok := m[id]
		if !ok {
			continue
		}
		skip := false
		for _, sel := range selected {
			for _, mx := range def.Mutex {
				if sel.FanID == mx {
					skip = true
					break
				}
			}
		}
		if skip || used[id] {
			continue
		}
		selected = append(selected, def)
		used[id] = true
	}
	return selected
}
