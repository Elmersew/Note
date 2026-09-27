CREATE DATABASE IF NOT EXISTS `sticky_notes`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE `sticky_notes`;

CREATE TABLE `users` (
  `id` CHAR(36) NOT NULL,
  `email` VARCHAR(191) NULL,
  `phone` VARCHAR(32) NULL,
  `password_hash` VARCHAR(191) NOT NULL,
  `display_name` VARCHAR(80) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `users_email_key` (`email`),
  UNIQUE INDEX `users_phone_key` (`phone`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `notes` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL DEFAULT '',
  `content` JSON NOT NULL,
  `plain_text` LONGTEXT NOT NULL,
  `is_pinned` BOOLEAN NOT NULL DEFAULT false,
  `is_archived` BOOLEAN NOT NULL DEFAULT false,
  `version` INTEGER NOT NULL DEFAULT 1,
  `deleted_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `notes_user_id_deleted_at_is_pinned_updated_at_idx` (`user_id`, `deleted_at`, `is_pinned`, `updated_at`),
  FULLTEXT INDEX `notes_title_plain_text_fts` (`title`, `plain_text`) WITH PARSER ngram,
  PRIMARY KEY (`id`),
  CONSTRAINT `notes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `tags` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  `color` VARCHAR(16) NOT NULL DEFAULT '#6d5dfc',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `tags_user_id_name_key` (`user_id`, `name`),
  PRIMARY KEY (`id`),
  CONSTRAINT `tags_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `note_tags` (
  `note_id` CHAR(36) NOT NULL,
  `tag_id` CHAR(36) NOT NULL,
  PRIMARY KEY (`note_id`, `tag_id`),
  CONSTRAINT `note_tags_note_id_fkey` FOREIGN KEY (`note_id`) REFERENCES `notes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `note_tags_tag_id_fkey` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `note_shares` (
  `id` CHAR(36) NOT NULL,
  `note_id` CHAR(36) NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `expires_at` DATETIME(3) NULL,
  `revoked_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `note_shares_token_hash_key` (`token_hash`),
  INDEX `note_shares_note_id_idx` (`note_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `note_shares_note_id_fkey` FOREIGN KEY (`note_id`) REFERENCES `notes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `tasks` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `status` ENUM('TODO', 'IN_PROGRESS', 'DONE') NOT NULL DEFAULT 'TODO',
  `priority` ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'MEDIUM',
  `due_at` DATETIME(3) NULL,
  `source_note_id` CHAR(36) NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `deleted_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `tasks_user_id_status_due_at_idx` (`user_id`, `status`, `due_at`),
  INDEX `tasks_source_note_id_idx` (`source_note_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `tasks_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `tasks_source_note_id_fkey` FOREIGN KEY (`source_note_id`) REFERENCES `notes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `calendar_events` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `starts_at` DATETIME(3) NOT NULL,
  `ends_at` DATETIME(3) NOT NULL,
  `timezone` VARCHAR(64) NOT NULL DEFAULT 'UTC',
  `is_all_day` BOOLEAN NOT NULL DEFAULT false,
  `location` VARCHAR(255) NULL,
  `source_note_id` CHAR(36) NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `deleted_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `calendar_events_user_id_starts_at_ends_at_idx` (`user_id`, `starts_at`, `ends_at`),
  INDEX `calendar_events_source_note_id_idx` (`source_note_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `calendar_events_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `calendar_events_source_note_id_fkey` FOREIGN KEY (`source_note_id`) REFERENCES `notes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `change_log` (
  `cursor` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` CHAR(36) NOT NULL,
  `entity_type` ENUM('NOTE', 'TASK', 'EVENT') NOT NULL,
  `entity_id` CHAR(36) NOT NULL,
  `operation` ENUM('UPSERT', 'DELETE') NOT NULL,
  `version` INTEGER NOT NULL,
  `changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `change_log_user_id_cursor_idx` (`user_id`, `cursor`),
  PRIMARY KEY (`cursor`),
  CONSTRAINT `change_log_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `mutations` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `idempotency_key` VARCHAR(191) NOT NULL,
  `response` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `mutations_user_id_idempotency_key_key` (`user_id`, `idempotency_key`),
  INDEX `mutations_created_at_idx` (`created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `mutations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
