package game

type WinResult struct {
	OK   bool
	Type string
}

func CanWin(hand []string, melds []Meld, ghostTile string) WinResult {
	normal, ghosts := splitGhost(hand)
	if isSevenPairs(normal, ghosts) {
		return WinResult{OK: true, Type: "qiDui"}
	}
	meldSets := len(melds)
	need := 4 - meldSets
	if canFormStandard(normal, ghosts, need) {
		return WinResult{OK: true, Type: "standard"}
	}
	return WinResult{OK: false}
}

func splitGhost(hand []string) ([]string, int) {
	normal := make([]string, 0, len(hand))
	ghosts := 0
	for _, t := range hand {
		if t == "ghost" {
			ghosts++
		} else {
			normal = append(normal, t)
		}
	}
	return normal, ghosts
}

func isSevenPairs(tiles []string, ghosts int) bool {
	if len(tiles)+ghosts != 14 {
		return false
	}
	counts := countMap(tiles)
	pairs, singles := 0, 0
	for _, c := range counts {
		switch c {
		case 2:
			pairs++
		case 4:
			pairs += 2
		case 1:
			singles++
		default:
			return false
		}
	}
	return pairs+ghosts >= 7
}

func canFormStandard(tiles []string, ghosts, setsNeeded int) bool {
	return solve(tiles, ghosts, setsNeeded, true)
}

func solve(tiles []string, ghosts, setsNeeded int, needPair bool) bool {
	if len(tiles) == 0 && ghosts == 0 {
		return setsNeeded == 0 && !needPair
	}
	sorted := SortTiles(tiles)
	counts := countMap(sorted)

	if needPair {
		for tile, cnt := range counts {
			if cnt >= 2 {
				if solve(removeTiles(sorted, tile, tile), ghosts, setsNeeded, false) {
					return true
				}
			}
			if cnt >= 1 && ghosts >= 1 {
				if solve(removeTiles(sorted, tile), ghosts-1, setsNeeded, false) {
					return true
				}
			}
		}
		if ghosts >= 2 {
			return solve(sorted, ghosts-2, setsNeeded, false)
		}
		return false
	}
	if setsNeeded == 0 {
		return len(tiles) == 0 && ghosts == 0
	}
	if len(sorted) == 0 {
		return ghosts >= 3 && solve(nil, ghosts-3, setsNeeded-1, false)
	}
	first := sorted[0]
	c0 := counts[first]
	if c0 >= 3 {
		if solve(removeTiles(sorted, first, first, first), ghosts, setsNeeded-1, false) {
			return true
		}
	}
	if c0 >= 2 && ghosts >= 1 {
		if solve(removeTiles(sorted, first, first), ghosts-1, setsNeeded-1, false) {
			return true
		}
	}
	if c0 >= 1 && ghosts >= 2 {
		if solve(removeTiles(sorted, first), ghosts-2, setsNeeded-1, false) {
			return true
		}
	}
	if ghosts >= 3 {
		if solve(sorted, ghosts-3, setsNeeded-1, false) {
			return true
		}
	}
	if !IsHonor(first) && len(first) == 2 {
		suit := string(first[1])
		num := int(first[0] - '0')
		if num <= 7 {
			t2 := string(rune('0'+num+1)) + suit
			t3 := string(rune('0'+num+2)) + suit
			if canTakeSeq(sorted, ghosts, first, t2, t3) {
				rest := removeTiles(sorted, first)
				rest = removeTiles(rest, t2)
				rest = removeTiles(rest, t3)
				if solve(rest, ghosts, setsNeeded-1, false) {
					return true
				}
			}
		}
	}
	return false
}

func canTakeSeq(tiles []string, ghosts int, a, b, c string) bool {
	counts := countMap(tiles)
	g := ghosts
	for _, t := range []string{a, b, c} {
		if counts[t] > 0 {
			counts[t]--
		} else if g > 0 {
			g--
		} else {
			return false
		}
	}
	return true
}

func removeTiles(tiles []string, remove ...string) []string {
	arr := append([]string(nil), tiles...)
	for _, t := range remove {
		for i, x := range arr {
			if x == t {
				arr = append(arr[:i], arr[i+1:]...)
				break
			}
		}
	}
	return arr
}

func countMap(tiles []string) map[string]int {
	m := map[string]int{}
	for _, t := range tiles {
		m[t]++
	}
	return m
}

func CanPeng(hand []string, tile string) bool {
	normal, ghosts := splitGhost(hand)
	cnt := 0
	for _, t := range normal {
		if t == tile {
			cnt++
		}
	}
	return cnt >= 2 || (cnt >= 1 && ghosts >= 1) || ghosts >= 2
}

func CanGang(hand []string, tile string) bool {
	normal, ghosts := splitGhost(hand)
	cnt := 0
	for _, t := range normal {
		if t == tile {
			cnt++
		}
	}
	return cnt >= 3 || cnt+ghosts >= 3
}

func CanWinWithTile(hand []string, tile string, melds []Meld, ghostTile string) bool {
	test := append(append([]string{}, hand...), tile)
	return CanWin(test, melds, ghostTile).OK
}
