-- gd_mahjong 初始化脚本（docker 首次启动自动执行）

CREATE DATABASE IF NOT EXISTS gd_mahjong DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gd_mahjong;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  open_id VARCHAR(64) NOT NULL UNIQUE,
  nick_name VARCHAR(64) DEFAULT '',
  avatar_url VARCHAR(512) DEFAULT '',
  coin BIGINT DEFAULT 10000,
  rank_tier VARCHAR(32) DEFAULT '青铜III',
  rank_score INT DEFAULT 0,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  INDEX idx_users_deleted (deleted_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rooms (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id VARCHAR(16) NOT NULL UNIQUE,
  owner_id BIGINT UNSIGNED NOT NULL,
  rule_id VARCHAR(32) DEFAULT 'gd_tuidaohu_v1',
  base_score INT DEFAULT 1,
  status VARCHAR(16) DEFAULT 'waiting',
  max_players INT DEFAULT 4,
  created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  INDEX idx_rooms_owner (owner_id),
  INDEX idx_rooms_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS room_players (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id VARCHAR(16) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  seat INT DEFAULT 0,
  ready TINYINT(1) DEFAULT 0,
  is_bot TINYINT(1) DEFAULT 0,
  nick_name VARCHAR(64) DEFAULT '',
  score INT DEFAULT 0,
  UNIQUE KEY uk_room_user (room_id, user_id),
  INDEX idx_rp_room (room_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS game_records (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id VARCHAR(16) NOT NULL,
  round INT DEFAULT 1,
  rule_id VARCHAR(32) DEFAULT '',
  winner_id BIGINT UNSIGNED DEFAULT 0,
  total_fan INT DEFAULT 0,
  settle_json TEXT,
  action_log LONGTEXT,
  created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_gr_room (room_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_stats (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  total_games INT DEFAULT 0,
  win_count INT DEFAULT 0,
  max_fan INT DEFAULT 0
) ENGINE=InnoDB;
