package game

import (
	"math/rand"
	"sort"
	"time"
)

var honorTiles = []string{"dong", "nan", "xi", "bei", "zhong", "fa", "bai"}

func BuildWall() []string {
	wall := make([]string, 0, 136)
	for _, s := range []string{"w", "t", "b"} {
		for n := 1; n <= 9; n++ {
			code := fmtTile(n, s)
			for i := 0; i < 4; i++ {
				wall = append(wall, code)
			}
		}
	}
	for _, h := range honorTiles {
		for i := 0; i < 4; i++ {
			wall = append(wall, h)
		}
	}
	return wall
}

func fmtTile(n int, suit string) string {
	return string(rune('0'+n)) + suit
}

func ShuffleWall(wall []string, seed int64) {
	r := rand.New(rand.NewSource(seed))
	for i := len(wall) - 1; i > 0; i-- {
		j := r.Intn(i + 1)
		wall[i], wall[j] = wall[j], wall[i]
	}
}

func SortTiles(tiles []string) []string {
	out := append([]string(nil), tiles...)
	sort.Slice(out, func(i, j int) bool {
		return tileOrder(out[i]) < tileOrder(out[j])
	})
	return out
}

func tileOrder(code string) int {
	if code == "ghost" {
		return 999
	}
	if len(code) == 2 && code[1] >= 'w' && code[1] <= 'b' {
		si := int(code[1]-'w') * 20
		return si + int(code[0]-'0')
	}
	for i, h := range honorTiles {
		if code == h {
			return 300 + i
		}
	}
	return 500
}

func IsHonor(code string) bool {
	for _, h := range honorTiles {
		if code == h {
			return true
		}
	}
	return false
}

func TileSuit(code string) string {
	if len(code) == 2 && code[1] >= 'w' && code[1] <= 'b' {
		return string(code[1])
	}
	return "honor"
}

func NowSeed() int64 { return time.Now().UnixNano() }
