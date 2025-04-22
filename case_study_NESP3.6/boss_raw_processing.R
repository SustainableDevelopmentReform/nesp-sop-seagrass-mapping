library(dplyr)
library(tidyr)


# some helper functions
most_common <- function(x) {
  xf <- x[!grepl("sand", x, ignore.case = TRUE)]
  if (length(xf) == 0) return("")
  tbl <- table(xf)
  names(tbl)[which.max(tbl)]
}
most_common_count <- function(x) {
  xf <- x[!grepl("sand", x, ignore.case = TRUE)]
  if (length(xf) == 0) return(0)
  tbl <- table(xf)
  as.integer(max(tbl))
}
second_common <- function(x) {
  xf <- x[!grepl("sand", x, ignore.case = TRUE)]
  if (length(xf) == 0) return("")
  tbl <- sort(table(xf), decreasing = TRUE)
  if (length(tbl) >= 2) names(tbl)[2] else ""
}
second_common_count <- function(x) {
  xf <- x[!grepl("sand", x, ignore.case = TRUE)]
  tbl <- sort(table(xf), decreasing = TRUE)
  if (length(tbl) >= 2) as.integer(tbl[2]) else 0
}
dom_species_calc <- function(x) {
  sg_strings = c("Posidonia australis", "Amphibolis antarctica", "Zostera spp")
  if (x == sg_strings[3]) return(3)
  if (x == sg_strings[2]) return(2)
  if (x == sg_strings[1]) return(1)
  if (!x %in% sg_strings[1]) return(0)
}

boss_pt1_raw <- read.csv("BOSS_NESP36_part1.csv", header = T, stringsAsFactors = F) %>%
  filter(!is.na(label.translated.id)) %>%
  mutate(drop_id = point.media.deployment.key) %>%
  select(drop_id, label.translated.name, label.name, point.pose.lat, point.pose.lon, point.pose.dep)

boss_pt1_processed <- boss_pt1_raw %>%
  group_by(drop_id) %>%
  summarise(
    lat = mean(point.pose.lat),
    lon = mean(point.pose.lon),
    depth = mean(point.pose.dep),
    n_label = n(),
    n_sg = sum(label.translated.name %in% "Seagrass"),
    n_ma = sum(label.translated.name %in% "Macroalgae"),
    n_sa = sum(label.translated.name %in% "Sand"),
    n_other = sum(!label.translated.name %in% c("Seagrass","Macroalgae","Sand")),
    top = most_common(label.name),
    top_n = most_common_count(label.name),
    top2 = second_common(label.name),
    top2_n = second_common_count(label.name)
  ) %>%
  ungroup() %>%
  mutate(
    sg_pct = n_sg / n_label,
    ma_pct = n_ma / n_label,
    sa_pct = n_sa / n_label,
    sg_pa = as.integer(sg_pct > 0.05),
    ma_pa = as.integer(ma_pct > 0.05),
    sa_pa = as.integer(sa_pct > 0.05),
    top_pct = top_n / n_label,
    top2_pct = top2_n / n_label) %>%
  rowwise() %>%
  mutate(
    dom_spp = dom_species_calc(top)
  )


boss_pt2_raw <- read.csv("BOSS_NESP36_part2.csv", header = T, stringsAsFactors = F) %>%
  filter(!is.na(label.translated.id)) %>%
  mutate(drop_id = point.media.deployment.key) %>%
  select(drop_id, label.translated.name, label.name, point.pose.lat, point.pose.lon, point.pose.dep)

boss_pt2_processed <- boss_pt2_raw %>%
  group_by(drop_id) %>%
  summarise(
    lat = mean(point.pose.lat),
    lon = mean(point.pose.lon),
    depth = mean(point.pose.dep),
    n_label = n(),
    n_sg = sum(label.translated.name %in% "Seagrass"),
    n_ma = sum(label.translated.name %in% "Macroalgae"),
    n_sa = sum(label.translated.name %in% "Sand"),
    n_other = sum(!label.translated.name %in% c("Seagrass","Macroalgae","Sand")),
    top = most_common(label.name),
    top_n = most_common_count(label.name),
    top2 = second_common(label.name),
    top2_n = second_common_count(label.name)
  ) %>%
  ungroup() %>%
  mutate(
    sg_pct = n_sg / n_label,
    ma_pct = n_ma / n_label,
    sa_pct = n_sa / n_label,
    sg_pa = as.integer(sg_pct > 0.05),
    ma_pa = as.integer(ma_pct > 0.05),
    sa_pa = as.integer(sa_pct > 0.05),
    top_pct = top_n / n_label,
    top2_pct = top2_n / n_label) %>%
  rowwise() %>%
  mutate(
    dom_spp = dom_species_calc(top)
  )


boss_nesp36_processed <- bind_rows(boss_pt1_processed, boss_pt2_processed)

write.csv(boss_nesp36_processed, file = "boss_nesp36_processed.csv", row.names = F)
